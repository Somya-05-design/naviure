export default function MinimalFooter() {
  return (
    <footer className="mt-auto flex h-[52px] items-center justify-center bg-black">
      <p className="text-[10px] uppercase tracking-[0.18em] text-soft-white/28">
        © {new Date().getFullYear()} NAVIURE
      </p>
    </footer>
  );
}
