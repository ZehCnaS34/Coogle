use std::collections::HashSet;

mod search {
    struct Search {
        directory_black_list: HashSet<&'static str>,
        file_black_list: HashSet<&'static str>,
    }
}