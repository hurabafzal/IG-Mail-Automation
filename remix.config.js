/** @type {import('@remix-run/dev').AppConfig} */
export default {
	ignoredRouteFiles: ["**/.*"],
	// appDirectory: "app",
	// assetsBuildDirectory: "public/build",
	// publicPath: "/build/",
	// serverBuildPath: "build/index.js",
	serverModuleFormat: "esm",
	browserNodeBuiltinsPolyfill: {
		modules: { url: true, querystring: true, crypto: true, punycode: true },
	},
};
