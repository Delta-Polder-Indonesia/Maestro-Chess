/** URLs for files served from Next's public directory, including static-export base paths. */
export function berkasPublik(jalur) {
  const basis = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");
  return `${basis}/${String(jalur || "").replace(/^\/+/, "")}`;
}

export const gambar = berkasPublik;
