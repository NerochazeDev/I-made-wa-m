import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import Home from "@/pages/home";
import Chats from "@/pages/chats";
import ChatView from "@/pages/chat";
import Stats from "@/pages/stats";
import { useWhatsappSocket } from "@/hooks/use-whatsapp";

const queryClient = new QueryClient();

function SocketBridge() {
  useWhatsappSocket();
  return null;
}

function Router() {
  return (
    <Layout>
      <SocketBridge />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/accounts/:accountId" component={Home} />
        <Route path="/accounts/:accountId/chats" component={Chats} />
        <Route path="/accounts/:accountId/chats/:chatId" component={ChatView} />
        <Route path="/accounts/:accountId/stats" component={Stats} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
