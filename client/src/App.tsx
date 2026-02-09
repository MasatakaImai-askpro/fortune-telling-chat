import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./hooks/use-auth";
import Top from "./pages/top";
import QuerentLogin from "./pages/querent-login";
import FortunetellerLogin from "./pages/fortuneteller-login";
import QuerentRegistration from "./pages/querent-registration";
import FortunetellerRegistration from "./pages/fortuneteller-registration";
import AdvisorApp from "./pages/advisor-app";
import AdminApp from "./pages/admin-app";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Top} />
      <Route path="/querent_login" component={QuerentLogin} />
      <Route path="/fortuneteller_login" component={FortunetellerLogin} />
      <Route path="/registration/querent" component={QuerentRegistration} />
      <Route path="/registration/fortuneteller" component={FortunetellerRegistration} />
      <Route path="/fortuneteller_mypage" component={AdvisorApp} />
      <Route path="/admin" component={AdminApp} />
      <Route>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center text-white/70">
            <h1 className="text-2xl font-bold mb-2">404</h1>
            <p>ページが見つかりません</p>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </QueryClientProvider>
  );
}
