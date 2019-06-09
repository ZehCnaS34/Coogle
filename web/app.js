/** @jsx jsx*/
import ReactDOM from "react-dom";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { jsx, css } from "@emotion/core";

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
      return filters.includes("/" + item.path);
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
    clearFilters() {
      setFilters([]);
    }
  };
}

function useSearch() {
  const [results, setResult] = useState([]);
  const { filters, addFilter, filteredResource, clearFilters } = useFileFilter(
    results
  );
  const tabulated = useTabulation({ resource: filteredResource });
  const tree = useTree(results);

  return {
    tree,
    filters,
    addFilter,
    clearFilters,
    tabulated,
    results,
    setResult
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

function TreeView({ tree, depth = 0, parent = "", onClick = () => {} }) {
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
        return (
          <li key={i}>
            <span
              onClick={() => onClick(parent + "/" + key)}
              css={{
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
                depth={depth + 1}
                parent={parent + "/" + key}
                onClick={onClick}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ProjectList() {
  let [projects, setProjects] = useState([]);

  const register = () => {
    const url = prompt("Repo Name");
    fetch(`/api/register?url=${encodeURIComponent(url)}`)
      .then(r => r.text())
      .then(() => {
        return fetch("/api/repos");
      })
      .then(r => r.json())
      .then(repos => {
        setProjects(repos);
      });
  };

  useEffect(() => {
    fetch("/api/repos")
      .then(response => response.json())
      .then(repos => {
        setProjects(repos);
      });
  }, []);

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
    tree,
    filters,
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
    <Container>
      <Row>
        <SideBar>
          <PanelSection title="Find">
            <SearchBar onSearch={search} />
          </PanelSection>
          <PanelSection title="File Filter" hideByDefault={true}>
            {filters.map((filter, i) => (
              <div key={i}>{filter}</div>
            ))}
          </PanelSection>
          <PanelSection title="File Tree">
            <TreeView tree={tree} onClick={addFilter} />
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
  );
}

ReactDOM.render(<App />, document.getElementById("app"));
