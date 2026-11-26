/**
 * Rentang UCI_Elo Stockfish 16.1+ (build Lite di repo ini) untuk pagar UI batas
 * kekuatan. Stockfish sendiri menjepit nilai di luar rentang, jadi ini pagar
 * yang aman untuk semua build. Konstanta lapisan aplikasi (bukan fasad engine)
 * agar tidak menambah ekspor barrel publik yang dikunci tes batas.
 */
export const RENTANG_ELO = { min: 1320, max: 3190, bawaan: 2000 };
