import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthContext.tsx";
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
    <AuthProvider>
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
    </AuthProvider>
  );
}

export default App;
