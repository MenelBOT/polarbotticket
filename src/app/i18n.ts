import i18next from "i18next";
import Backend from "i18next-fs-backend";
import path from "path";

await i18next.use(Backend).init({
	fallbackLng: "pl",
	preload: ["pl"],
	backend: {
		loadPath: path.join(process.cwd(), "locales/{{lng}}.json")
	},
	interpolation: {
		escapeValue: false
	}
});

export default i18next;