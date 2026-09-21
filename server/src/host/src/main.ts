import { resolve } from "node:path";
import { createApp } from "./create-app.js";

const port = Number(process.env.PORT ?? "3001");

const app = await createApp({
	configure: (nestApp) => {
		nestApp.useStaticAssets(resolve("wwwroot"));
	},
});

await app.listen(port);
// eslint-disable-next-line no-console
console.log(`api host listening on http://localhost:${port}`);
