#![feature(proc_macro_hygiene, decl_macro)]

#[macro_use]
extern crate rocket;
#[macro_use]
extern crate rocket_contrib;
#[macro_use]
extern crate serde_derive;
extern crate regex;

use dotenv;
use git2::build::RepoBuilder;
use git2::{Cred, Repository};
use git2::{FetchOptions, Progress, RemoteCallbacks};
use regex::Regex;
use rocket_contrib::json::Json;
use rocket_contrib::serve::StaticFiles;
use rocket_contrib::templates::Template;
use std::collections::{HashMap, HashSet};
use std::env;
use std::ffi::OsStr;
use std::fs::{self, DirEntry};
use std::io::{self, Error as IOError};
use std::path::{self, Path};
use std::thread;

struct Paths;

impl Paths {
    fn get_resources() -> String {
        dotenv::var("RESOURCE_DIR").unwrap()
    }

    fn get_public_ssh_key() -> String {
        dotenv::var("PUBLIC_SSH_KEY").unwrap()
    }

    fn get_private_ssh_key() -> String {
        dotenv::var("PRIVATE_SSH_KEY").unwrap()
    }
}

fn in_black_list(dir: &Path) -> bool {
    let mut black_list = HashSet::new();
    black_list.insert(".git");
    black_list.insert("target");
    black_list.insert("node_modules");
    black_list.insert("bundle.js");
    black_list.insert("bundle.js.map");
    black_list.insert(".DS_Store");

    // println!("Dir {:?}", dir.to_str());

    if let Some(file_name) = dir.file_name() {
        // println!("FileName {:?}", file_name);
        let stem = file_name.to_str().unwrap();
        return black_list.contains(stem);
    } else if let Some(stem) = dir.file_stem() {
        // println!("Stem {:?}", stem);
        let file_name = stem.to_str().unwrap();
        return black_list.contains(file_name);
    } else {
        true
    }
}

fn search_dir(dir: &Path, pattern: &String) -> Vec<Content> {
    let mut output = vec![];
    if in_black_list(dir) {
        return vec![];
    }

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries {
            let path = entry.unwrap().path();
            let path = path.as_path();
            if path.is_dir() {
                let mut results = search_dir(&path, pattern);
                output.append(&mut results);
            } else {
                if !in_black_list(path) {
                    let mut results = search_file(path, pattern);
                    output.append(&mut results);
                }
            }
        }
    }

    output
}

fn search_file(file_name: &Path, filter: &String) -> Vec<Content> {
    let matcher = Regex::new(filter.as_str()).unwrap();
    let contents = fs::read_to_string(&file_name);

    if let Err(_) = contents {
        // println!("Error reading {:?} {:?}", file_name, e);
        return vec![];
    }

    let mut line_number = 0;
    let matches: Vec<Content> = contents
        .unwrap()
        .lines()
        .map(|line| {
            line_number += 1;
            if let Some(matched) = matcher.find(line) {
                let file_name = file_name.clone().to_str().unwrap();
                return Some(Content {
                    start: matched.start() as u64,
                    end: matched.end() as u64,
                    line: line_number,
                    content: String::from(line),
                    path: file_name.to_string(),
                });
            }
            return None;
        })
        .filter(|content| content.is_some())
        .map(|content| content.expect(""))
        .collect();
    return matches;
}

#[derive(Serialize, Deserialize, Debug)]
struct Content {
    line: u64,
    start: u64,
    end: u64,
    content: String,
    path: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct SearchResult {
    line: u64,
    start: u64,
    end: u64,
    content: String,
    path: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct Project {
    url: String,
    company: String,
    owner: String,
    name: String,
}

impl Project {
    fn parse(url: &String) -> Option<Project> {
        let https_matcher = Regex::new(
            r"https?://(?P<company>github)\.com/(?P<owner>(\w)+)/(?P<project>(\S)+)(\.git)?",
        )
        .unwrap();

        let caps = https_matcher.captures(url.as_str());
        println!("Captured Group {:?}", caps);
        if caps.is_some() {
            let caps = caps.unwrap();
            let url = caps[0].to_string();
            let company = caps["company"].to_string();
            let owner = caps["owner"].to_string();
            let name = caps["project"].to_string();
            return Some(Project {
                url,
                company,
                owner,
                name,
            });
        }

        let git_matcher =
            Regex::new(r"git@(?P<company>github)\.com:(?P<owner>(\w)+)/(?P<project>(\S)+)(\.git)?")
                .unwrap();
        let caps = git_matcher.captures(url.as_str());
        println!("Captured Group {:?}", caps);
        if caps.is_some() {
            let caps = caps.unwrap();
            let url = caps[0].to_string();
            let company = caps["company"].to_string();
            let owner = caps["owner"].to_string();
            let name = caps["project"].to_string();
            return Some(Project {
                url,
                company,
                owner,
                name,
            });
        }

        None
    }

    fn clone(&self, directory: &Path) -> Result<(), &'static str> {
        let mut call_backs = RemoteCallbacks::new();
        call_backs.credentials(|one, two, three| {
            println!("Using Credentials, {:?}, {:?}, {:?}", one, two, three);
            let public_key_path = Paths::get_public_ssh_key();
            let public_key_path = Path::new(public_key_path.as_str());
            let private_key_path = Paths::get_private_ssh_key();
            let private_key_path = Path::new(private_key_path.as_str());
            Cred::ssh_key("git", Some(public_key_path), private_key_path, None)
        });

        let mut fetch_options = FetchOptions::new();
        fetch_options.remote_callbacks(call_backs);
        let result = RepoBuilder::new()
            .fetch_options(fetch_options)
            .clone(self.url.as_str(), directory);
        if result.is_ok() {
            return Ok(());
        } else {
            println!("{:?}", result.err());
            return Err("Failed to clone repo");
        }
    }

    fn get_projects() -> Vec<Project> {
        let mut output = vec![];

        let resources = Paths::get_resources();
        let resources = Path::new(resources.as_str());
        let entries = fs::read_dir(resources).unwrap();
        for entry in entries {
            let entry = entry.unwrap().path();
            let path = entry.as_path();
            if in_black_list(path) {
                continue;
            }
            let owner = entry.file_name().unwrap().to_str().unwrap();
            let names = fs::read_dir(path).unwrap();
            for name in names {
                let name = name.unwrap().path();
                let name = name.as_path();
                if in_black_list(name) {
                    continue;
                }
                let name = name.file_name().unwrap().to_str().unwrap();
                let url = format!("https://github.com/{}/{}", owner, name);
                let project = Project {
                    url,
                    owner: owner.to_string(),
                    company: String::from("github"),
                    name: name.to_string(),
                };
                output.push(project);
                println!("Project {:?}/{:?}", owner, name);
            }
        }

        return output;
    }

    fn get_path(&self) -> String {
        // .... I'm not good at rust... I might have to read the book a bit more.
        let resources = Paths::get_resources();
        let resources = Path::new(resources.as_str());
        let owner_path = Path::new(self.owner.as_str());
        let name_path = Path::new(self.name.as_str());
        let resources = resources.join(owner_path);
        let resources = resources.join(name_path);
        resources.to_str().unwrap().to_string()
    }

    fn get_path_until_project(&self, path: &Path) -> String {
        let project_path = self.get_path();
        let project_path = Path::new(project_path.as_str());

        let mut segments: Vec<&OsStr> = vec![];
        let mut cursor = path;
        while cursor != project_path {
            segments.push(cursor.file_name().unwrap());
            cursor = cursor.parent().unwrap();
        }

        let mut relative_path = self.name.clone();
        while segments.len() > 0 {
            let segment = segments.pop().unwrap();
            let segment = segment.to_str().unwrap();
            relative_path = relative_path + "/" + segment;
        }

        relative_path
    }

    fn search(&self, pattern: &String) -> Vec<SearchResult> {
        let path = format!("{}/{}/{}", Paths::get_resources(), self.owner, self.name);
        let path = Path::new(path.as_str());
        self.search_dir(&path, pattern)
    }

    fn search_dir(&self, dir: &Path, pattern: &String) -> Vec<SearchResult> {
        let mut output = vec![];
        if in_black_list(dir) {
            return vec![];
        }

        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries {
                let path = entry.unwrap().path();
                let path = path.as_path();
                if path.is_dir() {
                    let mut results = self.search_dir(&path, pattern);
                    output.append(&mut results);
                } else {
                    if !in_black_list(path) {
                        let mut results = self.search_file(path, pattern);
                        output.append(&mut results);
                    }
                }
            }
        }

        output
    }

    fn search_file(&self, file_name: &Path, filter: &String) -> Vec<SearchResult> {
        let matcher = Regex::new(filter.as_str()).unwrap();
        let contents = fs::read_to_string(&file_name);

        if let Err(_) = contents {
            // println!("Error reading {:?} {:?}", file_name, e);
            return vec![];
        }

        let mut line_number = 0;
        let matches: Vec<SearchResult> = contents
            .unwrap()
            .lines()
            .map(|line| {
                line_number += 1;
                if let Some(matched) = matcher.find(line) {
                    let file_name = file_name.clone().to_str().unwrap();
                    return Some(SearchResult {
                        start: matched.start() as u64,
                        end: matched.end() as u64,
                        line: line_number,
                        content: String::from(line),
                        path: self.get_path_until_project(Path::new(file_name)),
                    });
                }
                return None;
            })
            .filter(|content| content.is_some())
            .map(|content| content.expect(""))
            .collect();
        return matches;
    }
}

#[get("/search?<pattern>")]
fn search(pattern: String) -> Json<Vec<SearchResult>> {
    let projects = Project::get_projects();
    let projects: Vec<SearchResult> = projects
        .into_iter()
        .flat_map(|project| project.search(&pattern))
        .collect();
    Json(projects)
}

#[get("/repos")]
fn repos() -> Json<Vec<Project>> {
    Json(Project::get_projects())
}

#[get("/search-repo?<pattern>")]
fn search_repo(pattern: String) -> Json<Vec<SearchResult>> {
    let projects = Project::get_projects();
    projects
        .get(0)
        .and_then(|project| {
            let results = project.search(&pattern);
            Some(Json(results))
        })
        .unwrap()
}

#[get("/register?<url>")]
fn register(url: String) -> Json<&'static str> {
    let project = Project::parse(&url);
    if project.is_none() {
        println!("{:?}", url);
        return Json("Invalid URL");
    }

    println!("{:?}", project);

    let project = project.unwrap();
    let project_location = format!("{}/{}", project.owner, project.name);
    let project_location = Path::new(project_location.as_str());

    let resource_dir = Paths::get_resources();
    println!("Register/ {:?}", resource_dir);
    let resource_dir = Path::new(resource_dir.as_str());
    let output_dir = resource_dir.join(project_location);

    fs::create_dir_all(output_dir.to_str().unwrap()).unwrap();

    let output_dir = output_dir.as_path();

    let repo = match project.clone(output_dir) {
        Ok(_) => (),
        Err(e) => {
            println!("Error cloning repo {:?}", e);
            fs::remove_dir_all(output_dir.to_str().unwrap()).unwrap();
            return Json("Failed to clone repo");
        }
    };

    Json("Repository is cloned.")
}

fn print_dir(dir_entry: &DirEntry) {
    println!("Entry {:?}", dir_entry);
}

fn main() -> Result<(), IOError> {
    Paths::get_resources();
    rocket::ignite()
        .mount("/api", routes![search, register, repos, search_repo])
        .mount("/", StaticFiles::from("static"))
        .launch();
    Ok(())
}
