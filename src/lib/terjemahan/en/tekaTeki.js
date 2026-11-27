/** English dictionary for the Puzzles feature (one translation shelf per feature). */
export const tekaTeki = {
  judul: "Puzzles",
  deskripsi: "Train tactics with puzzles from the local database.",
  sumber: { label: "Puzzle source", skakmat: "Checkmates", video: "Tactics + video", harian: "Daily" },
  panel: {
    rating: "Rating", waktu: "Time", akurasi: "Accuracy", streak: "Streak", rataWaktu: "Avg time",
    giliranPutih: "White to move", giliranHitam: "Black to move",
    soalBaru: "New puzzle", petunjuk: "Get a hint", lihatSolusi: "View solution",
    bersihkanSesi: "Clear session", analisaPosisi: "Analyse this position", temaSoal: "Puzzle themes",
    pengaturan: "Training settings",
  },
  status: { benar: "Correct", salah: "Incorrect", belum: "Not attempted", memuat: "Loading puzzles…", kosong: "No puzzle matches the current filters.", gagal: "Failed to load puzzle data." },
  pesan: { benar: "Correct! Keep going.", salah: "Not quite — try another move.", selesai: "Puzzle solved.", solusi: "Showing the solution." },
  riwayat: { judul: "Session history", kosong: "No puzzle attempted yet." },
  pengaturan: {
    rentangRating: "Rating range", rentangRatingDeskripsi: "Puzzles are drawn from this rating range.",
    ratingMin: "Minimum rating", ratingMax: "Maximum rating",
    tema: "Theme", temaDeskripsi: "Limit puzzles to one tactical theme.", semuaTema: "All themes",
    progresif: "Progressive", progresifDeskripsi: "Raise the difficulty after each correct puzzle.",
    sembunyiRating: "Hide rating", sembunyiRatingDeskripsi: "Rating stays hidden until the puzzle is finished.",
    lompatCepat: "Jump to next puzzle", lompatCepatDeskripsi: "Open a new puzzle automatically after a correct answer.",
    catatWaktu: "Track time", catatWaktuDeskripsi: "Measure the time spent on each puzzle.",
  },
};
