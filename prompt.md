<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chess App Layout</title>
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Google Fonts: Inter -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        /* Pengaturan font dan warna dasar agar presisi dengan aplikasi desktop (En Croissant style) */
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #1A1B1E;
            color: #C1C2C5;
            user-select: none;
            overflow-x: hidden;
        }
    </style>
</head>
<body class="h-screen w-screen flex flex-col overflow-hidden bg-[#1A1B1E]">

    <!-- Top Application Title & Menu Bar -->
    <header class="h-[34px] w-full bg-[#141517] flex items-center justify-between px-3 shrink-0">
        <!-- Kiri: App Icon & Menu Items -->
        <div class="flex items-center space-x-3">
            <!-- App Logo (Mini Chess Board Icon) -->
            <div class="w-4 h-4 rounded-[3px] overflow-hidden grid grid-cols-2 grid-rows-2 shrink-0">
                <div class="bg-[#E8C59B]"></div>
                <div class="bg-[#A66D4F]"></div>
                <div class="bg-[#A66D4F]"></div>
                <div class="bg-[#E8C59B]"></div>
            </div>
            <!-- Menu Links -->
            <nav class="flex items-center space-x-3 text-[12px] text-[#7D8087]">
                <span class="cursor-default">File</span>
                <span class="cursor-default">View</span>
                <span class="cursor-default">Help</span>
            </nav>
        </div>

        <!-- Kanan: Windows Window Controls -->
        <div class="flex items-center space-x-5 pr-1 text-[#909296]">
            <!-- Minimize -->
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
                <line x1="0" y1="5" x2="10" y2="5" />
            </svg>
            <!-- Maximize -->
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
                <rect x="0.5" y="0.5" width="9" height="9" />
            </svg>
            <!-- Close -->
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
                <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" />
                <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" />
            </svg>
        </div>
    </header>

    <!-- Main Body Wrapper (Sidebar + Content) -->
    <div class="flex flex-1 overflow-hidden">
        
        <!-- Left Activity Sidebar -->
        <aside class="w-[46px] bg-[#141517] border-r border-[#2C2E33] flex flex-col items-center justify-between py-2 shrink-0">
            <!-- Top Navigation Icons -->
            <div class="flex flex-col items-center space-y-4 w-full">
                <!-- Active Icon: Chess Pawn with Left Blue Indicator -->
                <div class="relative w-full flex items-center justify-center py-1.5">
                    <div class="absolute left-0 top-1 bottom-1 w-[3px] bg-[#228BE6] rounded-r"></div>
                    <svg class="w-[20px] h-[20px] text-[#E9ECEF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 6a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
                        <path d="M8 9h8" />
                        <path d="M9 9l-1 7h8l-1 -7" />
                        <path d="M6 19h12" />
                        <path d="M7 16l-1 3" />
                        <path d="M17 16l1 3" />
                    </svg>
                </div>

                <!-- User / Profile Icon -->
                <div class="py-1.5 text-[#909296]">
                    <svg class="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="7" r="4" />
                        <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
                    </svg>
                </div>

                <!-- Files / Documents Icon -->
                <div class="py-1.5 text-[#909296]">
                    <svg class="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M15 3v4a1 1 0 0 0 1 1h4" />
                        <path d="M18 17h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h4l5 5v7a2 2 0 0 1 -2 2z" />
                        <path d="M16 17v2a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2" />
                    </svg>
                </div>

                <!-- Database Icon -->
                <div class="py-1.5 text-[#909296]">
                    <svg class="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                        <ellipse cx="12" cy="6" rx="8" ry="3" />
                        <path d="M4 6v6a8 3 0 0 0 16 0v-6" />
                        <path d="M4 12v6a8 3 0 0 0 16 0v-6" />
                    </svg>
                </div>

                <!-- Engines / CPU Chip Icon -->
                <div class="py-1.5 text-[#909296]">
                    <svg class="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="6" y="6" width="12" height="12" rx="1" />
                        <path d="M9 9h6v6h-6z" />
                        <path d="M3 10h3" />
                        <path d="M3 14h3" />
                        <path d="M10 3v3" />
                        <path d="M14 3v3" />
                        <path d="M21 10h-3" />
                        <path d="M21 14h-3" />
                        <path d="M14 21v-3" />
                        <path d="M10 21v-3" />
                    </svg>
                </div>
            </div>

            <!-- Bottom Settings Gear Icon -->
            <div class="pb-1 text-[#909296]">
                <svg class="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
                    <circle cx="12" cy="12" r="3" />
                </svg>
            </div>
        </aside>

        <!-- Main Workspace Container -->
        <main class="flex-1 flex flex-col bg-[#1A1B1E] overflow-y-auto">
            
            <!-- Tabs Bar -->
            <div class="h-[38px] w-full bg-[#141517] border-b border-[#2C2E33] flex items-center shrink-0">
                <!-- Active Tab: New Tab -->
                <div class="h-full w-[148px] bg-[#1A1B1E] border-r border-[#2C2E33] flex items-center justify-between px-3.5 relative">
                    <span class="text-[12px] font-medium text-[#E9ECEF]">New Tab</span>
                    <svg class="w-3 h-3 text-[#909296]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    <!-- Menutup border bawah pada tab aktif -->
                    <div class="absolute bottom-[-1px] left-0 right-0 h-[1px] bg-[#1A1B1E]"></div>
                </div>

                <!-- Add New Tab Button (+) -->
                <div class="h-full w-[34px] border-r border-[#2C2E33] flex items-center justify-center text-[#909296]">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </div>
            </div>

            <!-- Main Dashboard Content Area -->
            <div class="p-4 flex flex-col space-y-4">
                
                <!-- Top 5 Action Cards Grid -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    
                    <!-- Card 1: Play Chess -->
                    <div class="bg-[#25262B] border border-[#373A40] rounded-[6px] p-4 flex flex-col items-center justify-between min-h-[268px]">
                        <div class="flex flex-col items-center text-center mt-2">
                            <!-- Chess Pawn Icon -->
                            <svg class="w-[54px] h-[54px] text-[#B8BCC2] mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="6.5" r="3" />
                                <path d="M8.5 10.5h7" />
                                <path d="M9.5 10.5l-1 6.5h7l-1 -6.5" />
                                <path d="M6.5 20h11" />
                                <path d="M8 17l-1.5 3" />
                                <path d="M16 17l1.5 3" />
                            </svg>
                            <h2 class="text-[14.5px] font-semibold text-[#E9ECEF] mb-1">Play Chess</h2>
                            <p class="text-[12px] text-[#909296] leading-[1.35] px-1">Play against an engine or a friend</p>
                        </div>
                        <button class="w-full h-[36px] bg-[#23384D] text-[#55A3EA] text-[13px] font-medium rounded-[4px] mt-6 cursor-default">
                            Play
                        </button>
                    </div>

                    <!-- Card 2: Analysis Board -->
                    <div class="bg-[#25262B] border border-[#373A40] rounded-[6px] p-4 flex flex-col items-center justify-between min-h-[268px]">
                        <div class="flex flex-col items-center text-center mt-2">
                            <!-- Chessboard Icon -->
                            <svg class="w-[54px] h-[54px] text-[#B8BCC2] mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="4" y="4" width="16" height="16" rx="2" />
                                <rect x="4" y="4" width="4" height="4" fill="currentColor" stroke="none" />
                                <rect x="12" y="4" width="4" height="4" fill="currentColor" stroke="none" />
                                <rect x="8" y="8" width="4" height="4" fill="currentColor" stroke="none" />
                                <rect x="16" y="8" width="4" height="4" fill="currentColor" stroke="none" />
                                <rect x="4" y="12" width="4" height="4" fill="currentColor" stroke="none" />
                                <rect x="12" y="12" width="4" height="4" fill="currentColor" stroke="none" />
                                <rect x="8" y="16" width="4" height="4" fill="currentColor" stroke="none" />
                                <rect x="16" y="16" width="4" height="4" fill="currentColor" stroke="none" />
                            </svg>
                            <h2 class="text-[14.5px] font-semibold text-[#E9ECEF] mb-1">Analysis Board</h2>
                            <p class="text-[12px] text-[#909296] leading-[1.35] px-1">Analyze a game or position</p>
                        </div>
                        <button class="w-full h-[36px] bg-[#23384D] text-[#55A3EA] text-[13px] font-medium rounded-[4px] mt-6 cursor-default">
                            Open
                        </button>
                    </div>

                    <!-- Card 3: New Repertoire -->
                    <div class="bg-[#25262B] border border-[#373A40] rounded-[6px] p-4 flex flex-col items-center justify-between min-h-[268px]">
                        <div class="flex flex-col items-center text-center mt-2">
                            <!-- Target / Bullseye Icon -->
                            <svg class="w-[54px] h-[54px] text-[#B8BCC2] mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                                <path d="M12 7a5 5 0 1 0 5 5" />
                                <path d="M13 3.055a9 9 0 1 0 7.941 7.945" />
                                <path d="M15 6v3h3l3 -3h-3v-3z" />
                                <path d="M15 9l-3 3" />
                            </svg>
                            <h2 class="text-[14.5px] font-semibold text-[#E9ECEF] mb-1">New Repertoire</h2>
                            <p class="text-[12px] text-[#909296] leading-[1.35] px-1">Build and practice your opening repertoire</p>
                        </div>
                        <button class="w-full h-[36px] bg-[#23384D] text-[#55A3EA] text-[13px] font-medium rounded-[4px] mt-6 cursor-default">
                            Create
                        </button>
                    </div>

                    <!-- Card 4: Import Game -->
                    <div class="bg-[#25262B] border border-[#373A40] rounded-[6px] p-4 flex flex-col items-center justify-between min-h-[268px]">
                        <div class="flex flex-col items-center text-center mt-2">
                            <!-- File Import Icon -->
                            <svg class="w-[54px] h-[54px] text-[#B8BCC2] mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                                <path d="M5 13v-8a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2h-5.5" />
                                <path d="M2 19h7" />
                                <path d="M6 16l3 3l-3 3" />
                            </svg>
                            <h2 class="text-[14.5px] font-semibold text-[#E9ECEF] mb-1">Import Game</h2>
                            <p class="text-[12px] text-[#909296] leading-[1.35] px-1">Import a game from a PGN</p>
                        </div>
                        <button class="w-full h-[36px] bg-[#23384D] text-[#55A3EA] text-[13px] font-medium rounded-[4px] mt-6 cursor-default">
                            Import
                        </button>
                    </div>

                    <!-- Card 5: Puzzles -->
                    <div class="bg-[#25262B] border border-[#373A40] rounded-[6px] p-4 flex flex-col items-center justify-between min-h-[268px]">
                        <div class="flex flex-col items-center text-center mt-2">
                            <!-- Puzzle Piece Icon -->
                            <svg class="w-[54px] h-[54px] text-[#B8BCC2] mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M4 7h3a1 1 0 0 0 1 -1v-1a2 2 0 0 1 4 0v1a1 1 0 0 0 1 1h3a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h1a2 2 0 0 1 0 4h-1a1 1 0 0 0 -1 1v3a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-1a2 2 0 0 0 -4 0v1a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h1a2 2 0 0 0 0 -4h-1a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1" />
                            </svg>
                            <h2 class="text-[14.5px] font-semibold text-[#E9ECEF] mb-1">Puzzles</h2>
                            <p class="text-[12px] text-[#909296] leading-[1.35] px-1">Train your chess skills</p>
                        </div>
                        <button class="w-full h-[36px] bg-[#23384D] text-[#55A3EA] text-[13px] font-medium rounded-[4px] mt-6 cursor-default">
                            Train
                        </button>
                    </div>

                </div>

                <!-- Bottom Section: Recent Files Panel -->
                <div class="w-full bg-[#25262B] border border-[#373A40] rounded-[6px] p-4 min-h-[296px] flex flex-col">
                    <!-- Section Header -->
                    <h2 class="text-[16px] font-semibold text-[#E9ECEF]">Recent Files</h2>
                    
                    <!-- Empty State Centered Content -->
                    <div class="flex-1 flex flex-col items-center justify-center -mt-4">
                        <!-- Clock Icon -->
                        <svg class="w-[38px] h-[38px] text-[#7D8087] mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="9" />
                            <polyline points="12 7 12 12 15 15" />
                        </svg>
                        <p class="text-[13px] text-[#909296]">No files open recently</p>
                    </div>
                </div>

            </div>
        </main>
    </div>

</body>
</html>