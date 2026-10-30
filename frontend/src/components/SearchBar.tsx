import Icon from "./Icon";

export default function SearchBar({
  defaultValue = "",
  placeholder = "Search awards, topics or people",
  size = "md",
}: {
  defaultValue?: string;
  placeholder?: string;
  size?: "md" | "lg";
}) {
  const big = size === "lg";
  return (
    <form action="/search" role="search" className="w-full">
      <label className="sr-only" htmlFor={`search-${size}`}>
        Search research awards
      </label>
      <div
        className={`flex items-center gap-2 bg-surface border border-line-strong rounded-xl shadow-card focus-within:border-cherry ${
          big ? "p-2" : "p-1.5"
        }`}
      >
        <Icon name="search" size={big ? 24 : 20} className="text-ink-3 ml-3" />
        <input
          id={`search-${size}`}
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={`w-full bg-transparent border-0 focus:outline-none placeholder:text-ink-3 ${big ? "text-lead py-2" : "text-body py-1.5"}`}
        />
        <button
          type="submit"
          className={`bg-cherry hover:bg-cherry-dark text-white rounded-lg font-medium shrink-0 ${big ? "px-6 py-3 text-body" : "px-4 py-2 text-small"}`}
        >
          Search
        </button>
      </div>
    </form>
  );
}
