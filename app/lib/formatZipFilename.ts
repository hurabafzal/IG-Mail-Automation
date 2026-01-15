/**
 * Formats a title into a valid and clean filename for a zip file
 * @param title - The original title to be converted into a filename
 * @returns A cleaned filename with date and .zip extension
 */
export function formatZipFilename(title: string): string {
	// Helper function to clean string of invalid filename characters
	const cleanString = (str: string): string => {
		return (
			str
				// Replace spaces and invalid characters with hyphens
				.replace(/[<>:"/\\|?*\s]+/g, "-")
				// Replace accented characters
				.normalize("NFD")
				// biome-ignore lint/suspicious/noMisleadingCharacterClass: <explanation>
				.replace(/[\u0300-\u036f]/g, "")
				// Convert to lowercase
				.toLowerCase()
				// Replace multiple consecutive hyphens with single hyphen
				.replace(/-+/g, "-")
				// Remove leading and trailing hyphens
				.replace(/^-+|-+$/g, "")
				// Limit length (leaving room for date and extension)
				.slice(0, 50)
		);
	};

	// Get formatted date string (YYYY-MM-DD)
	const getDateString = (): string => {
		const now = new Date();
		return now.toISOString().split("T")[0];
	};

	const cleanTitle = cleanString(title);
	const dateStr = getDateString();

	// Combine elements with hyphens and add .zip extension
	return `${cleanTitle}-${dateStr}.zip`;
}
