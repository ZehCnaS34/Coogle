use std::path::{self, Path};

mod project {
    struct Project {
        url: String,
    }

    impl Project {
        fn from_resource(resource_name: &String) -> Project {
            Project { url: String::from("omg") }
        }
    }
}
