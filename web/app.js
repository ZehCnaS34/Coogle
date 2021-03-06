/** @jsx jsx*/
import ReactDOM from "react-dom";
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  createContext,
  useContext
} from "react";
import { jsx, css } from "@emotion/core";

const ApplicationStateContext = createContext();

function ApplicationState({ children }) {
  const [projects, setProjects] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  return (
    <ApplicationStateContext.Provider
      value={{
        projects,
        setProjects,
        results,
        setResults,
        loading,
        setLoading
      }}
    >
      {children}
    </ApplicationStateContext.Provider>
  );
}

/**
 * Returns a new string with the substring gone.
 * @param {string} str
 * @param {string} pattern
 */
function removePattern(str, pattern) {
  let index = str.indexOf(pattern);
  if (index === -1) return str;
  return str.slice(0, index) + str.slice(index + pattern.length);
}

function buildUrl(project) {
  const { name: __rawName, company, owner } = project;
  const name = removePattern(__rawName, ".git");

  return `https://${company}.com/${owner}/${name}/blob/master`;
}

function debounce(fn, delay = 100) {
  let timeout = null;
  return (...args) => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

function DelayInput({ onChange: __onChange }) {
  let [value, setValue] = useState("");

  let onChange = useMemo(() => debounce(__onChange, 500), []);

  const handleChange = e => {
    setValue(e.target.value);
    onChange(e.target.value);
  };

  return <input value={value} onChange={handleChange} />;
}

function HighlightContent({ content, start, end }) {
  let pre = content.slice(0, start);
  let highlight = content.slice(start, end);
  let post = content.slice(end);
  const highlightRef = useRef();

  return (
    <span style={{ whiteSpace: "nowrap" }}>
      {pre}
      <span
        ref={highlightRef}
        css={{
          backgroundColor: "#0096ff",
          paddingLeft: "0.5rem",
          paddingRight: "0.5rem",
          borderRadius: "0.3rem",
          color: "white",
          fontWeight: "bold",
          boxShadow: "inset 0 0 .2rem white"
        }}
      >
        {highlight}
      </span>
      {post}
    </span>
  );
}

function ResultItem({ result }) {
  const { projects } = useContext(ApplicationStateContext);

  const onLineClick = result => {
    console.log(projects);
    const { path: __path } = result;

    let projectName = __path.split("/")[0];
    let project = projects.find(({ name }) => projectName === name);
    const path =
      buildUrl(project) +
      "/" +
      __path
        .split("/")
        .slice(1)
        .join("/") +
      `#L${result.line}`; // NOTE: Kinda hacky.

    window.open(path, projectName);
  };

  return (
    <div
      css={{
        boxShadow: "0 0 1px white",
        borderRadius: ".4rem",
        transition: "transform 0.2s",
        margin: "1rem",
        "&:hover": {
          transform: "scale(1.01)"
        }
      }}
    >
      <p
        css={{
          margin: 0,
          padding: ".1rem 0 .1rem .5rem",
          background: "#eeeeee26",
          borderTopLeftRadius: "0.4rem",
          borderTopRightRadius: "0.4rem",
          borderLeft: "2px solid #0096ff"
        }}
      >
        {result.path}
      </p>
      <div
        css={{
          // padding: "1rem",
          boxShadow: "0 0 1px black",
          display: "flex"
        }}
      >
        <span
          css={{
            padding: "1rem",
            textAlign: "right",
            minWidth: "3rem",
            backgroundColor: "#eeeeee47",
            borderBottomLeftRadius: "0.4rem",
            borderLeft: "2px solid #0096ff"
          }}
          onClick={() => onLineClick(result)}
        >
          {result.line}
        </span>
        <div
          css={{
            flex: 1,
            padding: "1rem",
            maxHeight: "10rem",
            overflow: "auto"
          }}
        >
          <HighlightContent
            content={result.content}
            start={result.start}
            end={result.end}
          />
        </div>
      </div>
    </div>
  );
}

function ResultsList({ results }) {
  return (
    <div id="results">
      {results.map((result, id) => (
        <ResultItem key={id} result={result} />
      ))}
    </div>
  );
}

function Loader() {
  return <div id="loader" />;
}

function Row({ children, elevation = 5 }) {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: row;
        z-index: ${elevation};
      `}
    >
      {children}
    </div>
  );
}

function Column({ children, elevation = 5 }) {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        z-index: ${elevation};
      `}
    >
      {children}
    </div>
  );
}

function SearchBar({ onSearch }) {
  const [pattern, setPattern] = useState("");
  const [loading, setLoading] = useState(false);
  function handleEnter(e) {
    if (e.key === "Enter") {
      onSearch(pattern);
    }
  }

  const register = () => {
    setLoading(true);
    const url = prompt("Repo Name");
    fetch(`/api/register?url=${encodeURIComponent(url)}`)
      .then(r => r.text())
      .then(value => {
        console.log("Doen", value);
        setLoading(false);
      });
  };

  return (
    <Column>
      <input
        autoFocus={true}
        value={pattern}
        type="text"
        onChange={e => setPattern(e.target.value)}
        onKeyDown={handleEnter}
        placeholder="Regex"
      />
      <Row>
        <button css={{ flex: 1 }} onClick={onSearch.bind(null, pattern)}>
          Search
        </button>
      </Row>
    </Column>
  );
}

function useTree(resource) {
  return useMemo(() => {
    let tree = {};
    for (let item of resource) {
      let segments = item.path.split("/").filter(Boolean);
      let root = tree;
      while (segments.length > 0) {
        let segment = segments.shift();
        if (!root[segment]) root[segment] = {};
        root = root[segment];
      }
    }
    console.log(tree);
    return tree;
  }, [resource]);
}

function useTabulation({ amount = 50, resource }) {
  return useMemo(() => {
    let output = [];

    let times = Math.ceil(resource.length / amount);
    let offset = 0;
    while (times > 0) {
      output.push(resource.slice(offset, offset + amount));

      offset += amount;
      times--;
    }

    return output;
  }, [resource]);
}

function useFileFilter(resource = []) {
  const [filters, setFilters] = useState([]);
  let filteredResource = useMemo(() => {
    if (filters.length === 0) return resource;
    return resource.filter(item => {
      return filters.some(value => {
        return item.path.includes(value.slice(1));
      });
    });
  }, [resource, filters]);
  return {
    filteredResource,
    filters,
    addFilter(path) {
      setFilters(old => {
        return [...old, path];
      });
    },
    removeFilter(path) {
      setFilters(filters.filter(filter => filter !== path));
    },
    clearFilters() {
      setFilters([]);
    }
  };
}

function useSearch() {
  const [results, setResult] = useState([]);
  const {
    filters,
    addFilter,
    filteredResource,
    clearFilters,
    removeFilter
  } = useFileFilter(results);
  const tabulated = useTabulation({ resource: filteredResource });
  const tree = useTree(results);
  const filterTree = useTree(filteredResource);

  return {
    tree,
    filters,
    addFilter,
    removeFilter,
    clearFilters,
    tabulated,
    results,
    setResult,
    filterTree
  };
}

function Tabulation({ size, active, onSelect }) {
  return (
    <span
      css={{
        display: "block",
        marginTop: ".5rem",
        position: "relative",
        overflow: "auto",
        marginBottom: "1rem",
        padding: "1rem 0",
        width: "100%"
      }}
    >
      {new Array(size).fill(0).map((v, i) => (
        <span
          css={{
            marginLeft: "1rem",
            padding: "0 .5rem",
            cursor: "pointer",
            borderRadius: "1rem",
            color: active === i ? "#0096ff" : "unset",
            border: `1px solid ${active === i ? "#0096ff" : "white"}`
          }}
          key={i}
          data-active={active === i}
          onClick={() => onSelect(i)}
        >
          {i + 1}
        </span>
      ))}
    </span>
  );
}

function Container({ children }) {
  return <div css={{}}>{children}</div>;
}

function SideBar({ children }) {
  return (
    <aside
      css={css`
        background: #ffffff34;
        box-shadow: inset 0 0 1rem;
        position: relative;
        height: 100vh;
        width: 30vw;
        box-sizing: border-box;
        padding: 1rem;
        overflow: auto;
      `}
    >
      <Column>{children}</Column>
    </aside>
  );
}

function reversePath(path) {
  let segments = path.split("/");
  return segments.reduce((lsg, c) => [c, ...lsg]).join("/");
}

function Content({ children }) {
  return (
    <div
      css={{
        height: "100vh",
        position: "relative",
        overflow: "scroll",
        width: "70vw",
        boxSizing: "border-box",
        padding: "1rem"
      }}
    >
      {children}
    </div>
  );
}

const DEPTH_COLORS = ["purple", "blue", "green", "yellow", "orange", "red"];

function PanelSection({ title, children, hideByDefault = false }) {
  let [hidden, setHidden] = useState(hideByDefault);

  return (
    <div
      css={css`
        transition: box-shadow 0.2s, background 0.2s;
        margin: 1rem;
        background: ${hidden ? "#ffffff04" : "#ffffff34"};
        padding: 1rem;
        border-radius: 0.5rem;
        box-shadow: inset 0 0 ${hidden ? "0.5rem" : "1rem"} white;
      `}
    >
      <h4
        css={css`
          cursor: pointer;
          user-select: none;
          margin: 0;
        `}
        onClick={() => setHidden(!hidden)}
      >
        {title}
      </h4>
      <div
        css={{
          transition: "opacity 0.2s",
          boxShadow: "inset 0 0 1rem",
          background: "#ffffff34",
          borderRadius: ".5rem",
          padding: "1rem",
          maxHeight: "20rem",
          opacity: !hidden ? 1 : 0,
          display: !hidden ? "block" : "none",
          overflow: "auto"
        }}
      >
        {children}
      </div>
    </div>
  );
}

function TreeView({
  tree,
  depth = 0,
  parent = "",
  onClick = () => {},
  depthColor = false,
  highlightLeaf = false
}) {
  let keys = Object.keys(tree);
  return (
    <ul
      css={{
        paddingLeft: ".5rem",
        listStyle: "none",
        borderLeft: "1px solid black",
        "&:hover": {
          // borderLeft: `1px solid #505050`
          borderLeft: `1px solid ${DEPTH_COLORS[depth % DEPTH_COLORS.length]}`
        }
      }}
    >
      {keys.map((key, i) => {
        const isLeaf = Object.values(tree[key]).length === 0;
        return (
          <li key={i}>
            <span
              onClick={() => onClick(parent + "/" + key)}
              css={{
                color:
                  depthColor || (highlightLeaf && isLeaf)
                    ? DEPTH_COLORS[depth % DEPTH_COLORS.length]
                    : "unset",
                fontSize: highlightLeaf && isLeaf ? "1.3rem" : "unset",
                cursor: "pointer",
                border: "1px solid transparent",
                "&:hover": {
                  border: `1px solid ${
                    DEPTH_COLORS[depth % DEPTH_COLORS.length]
                  }`
                }
              }}
            >
              {key}
            </span>
            {Object.values(tree[key]).length === 0 ? null : (
              <TreeView
                tree={tree[key]}
                depthColor={depthColor}
                depth={depth + 1}
                parent={parent + "/" + key}
                highlightLeaf={highlightLeaf}
                onClick={onClick}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function useProjects() {
  const { projects, setProjects } = useContext(ApplicationStateContext);
  // let [projects, setProjects] = useState([]);

  const register = () => {
    const url = prompt("Repo Name");
    fetch(`/api/register?url=${encodeURIComponent(url)}`)
      .then(r => r.text())
      .then(() => {
        fetchProjects();
      });
  };

  function fetchProjects() {
    fetch("/api/repos")
      .then(response => response.json())
      .then(repos => {
        setProjects(repos);
      });
  }

  useEffect(() => {
    fetchProjects();
  }, []);

  return {
    projects,
    fetchProjects,
    register
  };
}

function ProjectList() {
  let { projects, register } = useProjects();

  return (
    <Column>
      <div>
        {projects.map((project, i) => (
          <p key={i}>{project.name}</p>
        ))}
      </div>
      <Row>
        <button onClick={register}>Register</button>
      </Row>
    </Column>
  );
}

function App() {
  const {
    results,
    setResult,
    tabulated,
    filterTree,
    tree,
    filters,
    removeFilter,
    addFilter,
    clearFilters
  } = useSearch();
  const [fresh, setFresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);

  function search(pattern) {
    setResult([]);
    setFresh(false);
    setLoading(true);
    clearFilters();
    setTab(0);
    fetch(`/api/search?pattern=${encodeURIComponent(pattern)}`)
      .then(r => r.json())
      .then(result => {
        setResult(result);
        setLoading(false);
      });
  }

  const resultList = useMemo(() => {
    if (fresh) return <h1>Search Away!</h1>;
    if (results.length === 0) return <h1>Couldn't find anything... Sorry!</h1>;
    return <ResultsList results={tabulated[tab] || []} />;
  }, [tabulated, tab]);

  return (
    <ApplicationState>
      <Container>
        <Row>
          <SideBar>
            <PanelSection title="Find">
              <SearchBar onSearch={search} />
            </PanelSection>
            <PanelSection title="File Filter" hideByDefault={true}>
              {filters.length > 0 && (
                <TreeView
                  highlightLeaf={true}
                  tree={filterTree}
                  onClick={removeFilter}
                />
              )}
            </PanelSection>
            <PanelSection title="File Tree" hideByDefault={true}>
              <TreeView
                tree={tree}
                onClick={path => {
                  addFilter(path);
                  setTab(0);
                }}
                highlightLeaf={true}
              />
            </PanelSection>
            <PanelSection title="Projects" hideByDefault={true}>
              <ProjectList />
            </PanelSection>
          </SideBar>
          <Content>
            {loading ? (
              <Loader />
            ) : (
              <React.Fragment>
                <Tabulation
                  size={tabulated.length}
                  active={tab}
                  onSelect={setTab}
                />

                {resultList}
              </React.Fragment>
            )}
          </Content>
        </Row>
      </Container>
    </ApplicationState>
  );
}

ReactDOM.render(<App />, document.getElementById("app"));
