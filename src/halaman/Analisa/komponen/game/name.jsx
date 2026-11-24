/* Port dari Brilliant-Chess (MIT, © 2025 Delo) — jangan sunting massal tanpa cek README. */
import Profile from "../svg/profile.jsx";
import CapturedPieces from "./capturedPieces.jsx";
import LencanaGelar from "../LencanaGelar.jsx";
import { useEffect, useState } from "react";
import { urlBendera } from "@/modul/profil/index.js";
// Data kartu pemain lama di localStorage menyimpan emoji; data baru menyimpan
// kode dua huruf. Terima keduanya agar cache lama tidak membuat bendera hilang.
function kodeBendera(nilai) {
  if (!nilai) return null;
  if (/^[a-z]{2}$/i.test(nilai)) return nilai.toLowerCase();
  const huruf = [...nilai];
  if (
    huruf.length === 2 &&
    huruf.every((c) => {
      const kode = c.codePointAt(0);
      return kode >= 0x1f1e6 && kode <= 0x1f1ff;
    })
  ) {
    return huruf
      .map((c) => String.fromCharCode(c.codePointAt(0) - 0x1f1e6 + 97))
      .join("");
  }
  return null;
}
function Name(props) {
  const [imgError, setImgError] = useState(false);
  const { white, captured, materialAdvantage, avatar, title, flag } = props;
  const name = props.children;
  // Avatar baru → hapus tanda galat agar bisa dicoba lagi.
  useEffect(() => setImgError(false), [avatar]);
  const showAvatar = avatar && !imgError;
  const kode = kodeBendera(flag);
  const srcBendera = urlBendera(kode);
  return <div className="flex flex-row items-start group-data-[panel-sejajar=true]/papan:text-sm text-[10px] font-bold text-foregroundHighlighted group-data-[panel-sejajar=true]/papan:gap-2 gap-[6px] flex-grow overflow-x-auto overflow-y-hidden">
            <div className={`group-data-[panel-sejajar=true]/papan:h-11 group-data-[panel-sejajar=true]/papan:w-11 h-7 w-7 flex flex-row justify-center items-end overflow-hidden ${white ? "bg-backgroundProfileWhite" : "bg-backgroundProfileBlack"}`}>
                {showAvatar ? (
                  <img className="h-full w-full object-cover" src={avatar} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgError(true)} />
                ) : (
                  <span className="h-6 w-6 group-data-[panel-sejajar=true]/papan:h-10 group-data-[panel-sejajar=true]/papan:w-10">
                    <Profile width="100%" height="100%" class={`${white ? "fill-foregroundProfileWhite" : "fill-foregroundProfileBlack"}`} />
                  </span>
                )}
            </div>
            <div className="flex flex-col justify-between h-7 group-data-[panel-sejajar=true]/papan:h-11">
                <span className="h-fit group-data-[panel-sejajar=true]/papan:pb-[1px] group-data-[panel-sejajar=true]/papan:pt-[2px] select-text text-nowrap">
                  {/* Gelar FIDE (GM, IM, FM, WGM, …) memakai lencana SVG yang
                      sama dengan kartu profil Wawasan; tingginya mengikuti
                      ukuran huruf baris nama (em), jadi proporsional di mode
                      sempit maupun vertikal. `null` bila pemain tak bergelar. */}
                  <LencanaGelar gelar={title} className="mr-1 inline-block h-[1.1em] w-auto shrink-0 align-[-0.2em]" />
                  {name}
                   {srcBendera ? (
                     <img
                       src={srcBendera}
                       alt=""
                       width={16}
                       height={12}
                       className="ml-1 inline-block h-3 w-4 rounded-[2px] object-cover align-[-1px] ring-1 ring-black/20"
                       onError={(event) => { event.currentTarget.style.display = "none"; }}
                       loading="lazy"
                     />
                   ) : null}
                </span>
                <CapturedPieces advantage={materialAdvantage} white={white} pieces={captured} />
            </div>
        </div>;
}
export {
  Name as default
};
