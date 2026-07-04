export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-10 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/occa-mark.svg" alt="OCCA" width={16} height={16} className="opacity-80" />
          <span className="text-muted">OCCA Open Market</span>
          <span>part of OCCA</span>
        </div>
        {/* Docs / $OCCA / X links return here when those destinations exist —
            no dead placeholder links. */}
      </div>
    </footer>
  );
}
