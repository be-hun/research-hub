import Icon from "./Icon";

export default function SearchBar({ defaultValue = "", placeholder }: { defaultValue?: string; placeholder: string }) {
  return (
    <form
      action="/search"
      className="w-full bg-surface-container-lowest border border-[#CBD5E1] rounded-xl p-1.5 shadow-sm focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/20 flex items-center gap-2"
    >
      <Icon name="search" size={22} className="text-secondary ml-3" />
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full bg-transparent border-0 text-body-md placeholder:text-slate-400 focus:ring-0 focus:outline-none py-1.5"
      />
      <button
        type="submit"
        className="bg-secondary hover:bg-[#243EA8] text-white px-5 py-2 rounded-lg text-label-md flex items-center gap-1.5 shrink-0"
      >
        <Icon name="auto_awesome" size={18} />
        <span>AI Search</span>
      </button>
    </form>
  );
}
