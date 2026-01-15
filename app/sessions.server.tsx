enum Theme {
	DARK = "dark",
	LIGHT = "light",
}

type ThemeSession = {
	getTheme: () => Theme | null;
	setTheme: (theme: Theme) => void;
	commit: () => Promise<string>;
};

export const themeSessionResolver = (request: Request) => {
	const cookie = request.headers.get("Cookie");
	// get the "theme" cookie from the request
	const themeCookie = cookie?.split("; ").find((c) => c.startsWith("theme="));
	// parse the cookie value
	const theme = themeCookie?.split("=")[1];
	// create a new theme session
	const themeSession: ThemeSession = {
		getTheme() {
			return theme as Theme | null;
		},
		setTheme(theme: Theme) {
			// set the theme cookie
			document.cookie = `theme=${theme}; path=/; max-age=31536000; samesite=strict`;
		},
		commit() {
			return new Promise((r) => r(""));
		},
	};

	return themeSession;
};
