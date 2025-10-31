import { Routes, Route } from "react-router-dom";
import { useState } from "react";
import Top from "./top";
import FortunetellerLogin from "./fortuneteller_login.tsx";
import QuerentLogin from "./querent_login.tsx";
import FortunetellerRegistration from "./fortuneteller_registration.tsx";
import QuerentRegistration from "./querent_registration.tsx";
import AdvisorApp from "./advisorapp.tsx";
import "./App.css";
import "./index.css";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <Routes>
        <Route path="/" element={<Top />} />
        <Route path="/fortuneteller_login" element={<FortunetellerLogin />} />
        <Route path="/querent_login" element={<QuerentLogin />} />
        <Route
          path="/registration/fortuneteller"
          element={<FortunetellerRegistration />}
        />
        <Route
          path="/registration/querent"
          element={<QuerentRegistration />}
        />
        <Route path="/fortuneteller_mypage" element={<AdvisorApp />} />
      </Routes>

      {/* 以下いつもの Vite + React のデモUI */}
      {/* <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p> */}
    </>
  );
}

export default App;
