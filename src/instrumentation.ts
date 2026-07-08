export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setGlobalDispatcher, ProxyAgent } = await import("undici");
    const proxy = process.env.HTTP_PROXY || "http://127.0.0.1:15236";
    const dispatcher = new ProxyAgent(proxy);
    setGlobalDispatcher(dispatcher);
    console.log(`[proxy] Global fetch proxy set to ${proxy}`);
  }
}
