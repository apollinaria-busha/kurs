/* Пак режиссёра монтажа («Полезные материалы» → #mat/pk…).
   Загружается только автору (isAuthor) из index.html — ученицы его пока не скачивают.
   Все классы с префиксом pk-, чтобы не пересекаться со стилями приложения. */
(function(){
const FONTS="Inter:wght@400;700&family=Rubik+Mono+One&family=Russo+One&family=Rubik+Bubbles&family=Pangolin&family=JetBrains+Mono:wght@500&family=Unbounded:wght@700&family=Cormorant+Infant:wght@600&family=Caveat:wght@700&family=Playfair+Display:wght@700&family=Alumni+Sans:wght@700&family=Fira+Sans+Extra+Condensed&family=Amatic+SC:wght@700&family=Lobster&family=Rubik+Spray+Paint&family=PT+Serif&family=Nunito:wght@600&family=Manrope:wght@500";
const CSS=`
.pk{display:grid;gap:18px}
.pk-author{font-family:var(--f-mono);font-size:11px;letter-spacing:.06em;color:#ffd27a;background:#2a1f00;border-radius:10px;padding:8px 12px}
.pk-hero{position:relative;display:grid;gap:6px;border-radius:18px;background:var(--sun);color:var(--sun-ink);padding:18px;text-decoration:none;overflow:hidden;margin-bottom:6px}
.pk-hero .ch{position:absolute;right:-10px;top:-10px;width:120px;height:120px;background:conic-gradient(var(--sun-ink) 25%,transparent 0 50%,var(--sun-ink) 0 75%,transparent 0) 0 0/30px 30px;opacity:.14;transform:rotate(12deg)}
.pk-hero b{font-size:20px;font-weight:900;line-height:1.15;max-width:15ch}
.pk-hero small{font-size:12.5px;max-width:36ch}
.pk-new{justify-self:start;background:var(--sun-ink);color:var(--sun);font:500 10px var(--f-mono);letter-spacing:.08em;padding:3px 7px;border-radius:5px}
.pk-badge{font:500 10px var(--f-mono);letter-spacing:.06em;padding:2px 6px;border-radius:5px;background:var(--sun);color:var(--sun-ink);white-space:nowrap}
.pk-badge.soon{background:#24204a;color:#c3bdff}.pk-badge.o{background:var(--panel2);color:var(--muted)}
.pk-seg{display:grid;grid-template-columns:1fr 1fr;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:4px;gap:4px}
.pk-seg button{border:0;border-radius:10px;padding:10px;background:transparent;font:800 13px inherit;font-family:inherit;cursor:pointer;color:var(--muted)}
.pk-seg button[aria-pressed="true"]{background:var(--sun);color:var(--sun-ink)}
.pk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (min-width:900px){.pk-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.pk-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;display:grid;gap:6px;align-content:start;min-height:118px;color:var(--text);text-decoration:none}
.pk-card .ic{width:36px;height:36px;border-radius:10px;background:var(--panel2);display:grid;place-items:center;font-weight:800;font-size:13px;color:var(--sun)}
.pk-card b{font-size:14px;line-height:1.25}.pk-card small{color:var(--muted);font-size:12px;line-height:1.35}
.pk-card .top{display:flex;justify-content:space-between;align-items:start;gap:6px}
.pk-card.wide{grid-column:1/-1}
.pk-news{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--sun);border-radius:12px;padding:12px 14px;display:grid;gap:4px;font-size:13px}
.pk-list{display:grid;gap:8px}
.pk-row{display:flex;gap:12px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px 14px;color:var(--text);text-decoration:none}
.pk-row .ic{width:40px;height:40px;border-radius:11px;background:var(--panel2);flex:none;display:grid;place-items:center;font-weight:800;font-size:13px;color:var(--sun)}
.pk-row .tx{display:grid;gap:2px;min-width:0;flex:1}.pk-row .tx b{font-size:14px;line-height:1.25}.pk-row .tx small{color:var(--muted);font-size:12px;line-height:1.35}
.pk-row .arr{color:var(--muted);flex:none}
.pk-chips{display:flex;flex-wrap:wrap;gap:6px}
.pk-chip{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 12px;font-weight:700;font-size:12px;cursor:pointer;color:var(--text);font-family:inherit;white-space:nowrap}
.pk-chip[aria-pressed="true"]{background:var(--sun);border-color:var(--sun);color:var(--sun-ink)}
.pk-box{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;display:grid;gap:10px}
.pk-box h3{margin:0;font-size:15px;font-weight:800}
.pk-muted{color:var(--muted)}
.pk-btn{border:0;border-radius:12px;padding:12px 14px;font-weight:800;font-size:14px;background:var(--sun);color:var(--sun-ink);cursor:pointer;text-align:center;font-family:inherit;text-decoration:none}
.pk-btn.ghost{background:var(--panel2);color:var(--text)}
.pk-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.pk-steps{margin:0;padding:0;list-style:none;display:grid;gap:10px;counter-reset:s}
.pk-steps li{display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:start;counter-increment:s}
.pk-steps li::before{content:counter(s);width:28px;height:28px;border-radius:8px;background:var(--sun);color:var(--sun-ink);display:grid;place-items:center;font-weight:900;font-size:13px}
.pk details{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.pk details summary{cursor:pointer;font-weight:800;display:flex;justify-content:space-between;gap:8px;list-style:none}
.pk details summary::-webkit-details-marker{display:none}
.pk details summary::after{content:"+";color:var(--sun);font-weight:900}.pk details[open] summary::after{content:"–"}
.pk details ul{margin:10px 0 0;padding-left:18px;color:var(--muted);display:grid;gap:4px}
.pk-styles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (min-width:900px){.pk-styles{grid-template-columns:repeat(4,minmax(0,1fr))}}
.pk-st{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--panel);display:grid;color:var(--text);text-decoration:none}
.pk-st .sw{height:92px;display:grid;place-items:center;font-size:22px}
.pk-st .meta{padding:10px 12px;display:grid;gap:3px}.pk-st .meta b{font-size:13.5px}.pk-st .meta small{color:var(--muted);font-size:11.5px;line-height:1.35}
.pk-pal{display:flex;gap:6px}.pk-pal span{flex:1;height:42px;border-radius:8px;display:grid;place-items:end center;font:500 9px var(--f-mono);padding-bottom:3px}
.pk-font{display:grid;gap:6px;background:var(--panel2);border-radius:12px;padding:14px}
.pk-font .a{font-size:28px;line-height:1.1}.pk-font .b{font-size:14px;color:var(--muted)}
.pk-font .lang{font:500 10px var(--f-mono);color:var(--ok)}
.pk-ctabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
.pk-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.pk-tile{aspect-ratio:1;border-radius:12px;display:grid;place-items:center;font-size:10.5px;text-align:center;padding:6px;position:relative;overflow:hidden;border:1px solid var(--line);color:var(--text);background:var(--panel2)}
.pk-tile .fmt{position:absolute;left:5px;bottom:5px;font:500 8.5px var(--f-mono);background:rgba(0,0,0,.55);color:#fff;padding:2px 4px;border-radius:4px}
.pk-checker{background:repeating-conic-gradient(#2a2822 0 25%,#1d1b17 0 50%) 0 0/14px 14px}.pk-black{background:#000}.pk-green{background:#00b140}
.pk-svc{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;display:grid;gap:10px}
.pk-svc .hd{display:flex;justify-content:space-between;gap:8px;align-items:start}.pk-svc .hd b{font-size:16px;font-weight:800}
.pk-svc .what{font-size:13px;color:var(--muted);margin:-6px 0 0}
.pk-plats{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.pk-plat{font:500 10px var(--f-mono);border:1px solid var(--line);border-radius:5px;padding:2px 5px;color:var(--muted);white-space:nowrap}
.pk-tiers{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12.5px;line-height:1.4}
.pk-tiers div{border-radius:10px;padding:9px 10px}.pk-tiers .f{background:#15301f}.pk-tiers .p{background:#33270c}
.pk-tiers i{display:block;font-style:normal;font:500 10px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px}
.pk-tiers .f i{color:var(--ok)}.pk-tiers .p i{color:#ffc45a}
.pk-tip{font-size:12.5px;border-left:3px solid var(--sun);padding:2px 0 2px 10px;margin:0}.pk-tip em{font-style:normal;font-weight:800;color:var(--sun)}
.pk-pick{font:500 10px var(--f-mono);background:var(--sun);color:var(--sun-ink);padding:2px 6px;border-radius:5px;margin-left:6px;vertical-align:2px}
.pk-check{display:flex;gap:10px;align-items:start;padding:8px 0;border-bottom:1px solid var(--line);cursor:pointer}
.pk-check:last-child{border-bottom:0}.pk-check input{accent-color:var(--sun);width:18px;height:18px;margin-top:1px;flex:none}
.pk-check small{display:block;color:var(--muted);font-size:12px}
.pk-vid{aspect-ratio:9/16;border-radius:12px;background:linear-gradient(160deg,#2a2618,#14130f);display:grid;place-items:center;position:relative;border:1px solid var(--line)}
.pk-vid::after{content:"";border-left:16px solid var(--sun);border-top:10px solid transparent;border-bottom:10px solid transparent;margin-left:4px}
.pk-vid small{position:absolute;bottom:6px;right:7px;font:500 10px var(--f-mono);color:var(--muted)}
.pk-tuts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
@media (max-width:440px){.pk-tuts{grid-template-columns:repeat(2,minmax(0,1fr))}}
.pk-tut{display:grid;gap:6px;font-size:12px;line-height:1.3}
.pk-fnt{padding:10px 14px}.pk-fnt .smp{font-size:22px;line-height:1.2;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pk-fnt .nw{color:var(--sun);font-weight:700}
.pk-note{font-size:12px;color:var(--muted);border:1px dashed var(--line);border-radius:12px;padding:10px 12px}
.pk-empty{color:var(--muted);text-align:center;padding:20px;border:1px dashed var(--line);border-radius:14px}
`;
(function inject(){const s=document.createElement("style");s.textContent=CSS;document.head.appendChild(s);
 const l=document.createElement("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family="+FONTS+"&display=swap";document.head.appendChild(l)})();

/* ---------- данные ---------- */
// f: акцентный шрифт [название, вес], fb: основной. Все шрифты проверены: есть кириллица и латиница.
const STYLES=[
 {id:"ios",n:"iOS и интерфейсы",em:"▢",for:["Эксперт","Обучение","Блогер"],pal:["#F2F2F7","#0A84FF","#34C759","#FF375F","#1C1C1E"],f:["Inter","700"],fb:"Manrope",bg:"linear-gradient(135deg,#e9ecf3,#c9d4ea)",fg:"#0A84FF",ex:"уведомления, окна, кнопки «подписаться», курсор, загрузка, плеер"},
 {id:"retro",n:"Ретро 70–90",em:"◐",for:["Лайфстайл","Мода","Музыка"],pal:["#F4E1C1","#E8833A","#C0392B","#2E6E6A","#2B1E16"],f:["Rubik Mono One","400"],fb:"PT Serif",bg:"linear-gradient(180deg,#E8833A 0 33%,#C0392B 0 66%,#2E6E6A 0)",fg:"#F4E1C1",ex:"плёнка, VHS, старые экраны, диско-лучи"},
 {id:"y2k",n:"Y2K / 2000-е",em:"✦",for:["Бьюти","Мода","Молодёжь"],pal:["#E9E9F2","#B9C6FF","#FF8BD8","#9AF2FF","#2A2A40"],f:["Russo One","400"],fb:"Montserrat",bg:"linear-gradient(135deg,#ffd6f3,#b9c6ff,#9af2ff)",fg:"#2A2A40",ex:"хром, глянец, блёстки, пиксели, окна XP"},
 {id:"anime",n:"Аниме",em:"✸",for:["Молодёжь","Развлечения","Геймеры"],pal:["#FFF5F8","#FF4F79","#3D5AFE","#FFE04D","#111111"],f:["Rubik Bubbles","400"],fb:"Nunito",bg:"repeating-conic-gradient(from 0deg at 50% 50%,#fff 0 6deg,#ffe3ea 0 12deg)",fg:"#FF4F79",ex:"спидлайны, вспышки, эмоции-значки, манга-рамки, сакура"},
 {id:"doodle",n:"Мультяшный / дудлы",em:"✎",for:["Дети","Еда","Юмор","Обучение"],pal:["#FFFDF5","#FFB800","#3CB371","#FF6B6B","#222222"],f:["Pangolin","400"],fb:"Nunito",bg:"#FFFDF5",fg:"#222",ex:"каракули, смешные стрелки, обводки от руки"},
 {id:"tech",n:"Технологичный / IT",em:"</>",for:["IT","Онлайн-школы","ИИ-блогеры"],pal:["#0B0F14","#00FF9C","#00B3FF","#7A5CFF","#E6EDF3"],f:["JetBrains Mono","500"],fb:"Manrope",bg:"#0B0F14",fg:"#00FF9C",ex:"терминал, код, HUD, сетки, глитч, интерфейсы ИИ"},
 {id:"future",n:"Футуризм / 3D",em:"◈",for:["Музыка","Техно","Крипто"],pal:["#08070D","#C0C6D6","#8A5CFF","#00E5FF","#FF2E88"],f:["Unbounded","700"],fb:"Manrope",bg:"radial-gradient(circle at 30% 30%,#c0c6d6,#3a3550 45%,#08070d)",fg:"#00E5FF",ex:"хром, неон, голограммы"},
 {id:"romance",n:"Романтика / нежно",em:"♡",for:["Бьюти","Свадьбы","Психологи"],pal:["#FFF4F1","#F7C6CF","#E8A0B4","#C9B8E8","#7A4E5C"],f:["Cormorant Infant","600"],fb:"Montserrat",bg:"radial-gradient(circle at 70% 30%,#fff,#f7c6cf 60%,#e8a0b4)",fg:"#7A4E5C",ex:"пастель, сердечки, блики, кружево, цветы, свечение"},
 {id:"scrap",n:"Скрапбук / коллаж",em:"✂",for:["Лайфстайл","Путешествия","Блогер"],pal:["#EFE6D6","#D9B99B","#8BA888","#C96B4B","#3B3027"],f:["Caveat","700"],fb:"Montserrat",bg:"#EFE6D6",fg:"#3B3027",ex:"рваная бумага, скотч, полароиды, вырезки"},
 {id:"lux",n:"Люкс / минимализм",em:"◇",for:["Премиум","Недвижимость","Ювелирка"],pal:["#F7F5F0","#D8CFC0","#B89A5B","#4A4A4A","#111111"],f:["Playfair Display","700"],fb:"Montserrat",bg:"linear-gradient(135deg,#f7f5f0,#d8cfc0)",fg:"#B89A5B",ex:"тонкие линии, золото, мрамор, воздух"},
 {id:"cinema",n:"Кино",em:"▭",for:["Реклама","Тревел","Сторителлинг"],pal:["#0A0A0A","#E9E1D3","#C9A86A","#5E6B73","#8C1C13"],f:["Alumni Sans","700"],fb:"PT Serif",bg:"linear-gradient(#000 0 18%,#5E6B73 18% 82%,#000 82%)",fg:"#E9E1D3",ex:"леттербокс, титры, зерно, хлопушка, «конец фильма»"},
 {id:"expert",n:"Эксперт / бизнес",em:"↗",for:["Эксперт","Коучи","Продажи"],pal:["#FFFFFF","#1E3A8A","#22C55E","#F59E0B","#0F172A"],f:["Montserrat","900"],fb:"Inter",bg:"linear-gradient(135deg,#fff,#dbe4ff)",fg:"#1E3A8A",ex:"графики, стрелки роста, цифры, чек-листы, выделения"},
 {id:"grunge",n:"Гранж / стрит",em:"✶",for:["Мода","Спорт","Музыка"],pal:["#1A1A1A","#E5E5E5","#FF3B30","#FFD60A","#6B6B6B"],f:["Rubik Spray Paint","400"],fb:"Fira Sans Extra Condensed",bg:"#1A1A1A",fg:"#FFD60A",ex:"спрей, граффити, грязь, стикер-бомбинг"},
 {id:"eco",n:"Природа / эко",em:"❦",for:["Эко-бренды","Йога","Wellness"],pal:["#F3EFE4","#A7B88F","#5F7A4E","#D9A45B","#3A3A2E"],f:["Amatic SC","700"],fb:"Nunito",bg:"linear-gradient(160deg,#f3efe4,#a7b88f)",fg:"#3A3A2E",ex:"листья, акварель, солнце, крафт"},
 {id:"kk",n:"КОД КРЕАТОРА",em:"♞",for:["Свои ролики"],pal:["#FFAD05","#16130C","#F3EFE6","#201E19","#A29B8C"],f:["Unbounded","700"],fb:"Manrope",bg:"conic-gradient(#16130C 25%,#FFAD05 0 50%,#16130C 0 75%,#FFAD05 0) 0 0/23px 23px",fg:"#FFAD05",ex:"шахматы, жёлтый, фирменные плашки"},
 {id:"season",n:"Сезонные",em:"❄",for:["Все к праздникам"],pal:["#FFFFFF","#D7263D","#1B998B","#F4D35E","#0D3B66"],f:["Lobster","400"],fb:"Montserrat",bg:"linear-gradient(135deg,#0D3B66,#1B998B)",fg:"#F4D35E",ex:"Новый год, 14 февраля, 8 марта, Хэллоуин, лето"}
];
// по 20 шрифтов к стилю: Google Fonts (OFL, можно в коммерцию), у всех кириллица + латиница, нет в подборках Буши.
// [название, тип, год добавления, вес для превью]
const F20={"ios": [["Onest", "гротеск", 2023, 700], ["Geologica", "гротеск", 2023, 700], ["Golos Text", "гротеск", 2023, 700], ["Geist", "гротеск", 2024, 700], ["Inter Tight", "гротеск", 2022, 700], ["Wix Madefor Display", "гротеск", 2023, 700], ["Wix Madefor Text", "гротеск", 2023, 700], ["Commissioner", "гротеск", 2020, 700], ["Ubuntu Sans", "гротеск", 2024, 700], ["SN Pro", "гротеск", 2026, 700], ["Liter", "гротеск", 2025, 400], ["Nata Sans", "гротеск", 2025, 700], ["TikTok Sans", "гротеск", 2025, 700], ["Roboto Flex", "гротеск", 2022, 700], ["IBM Plex Sans", "гротеск", 2018, 700], ["Rubik", "гротеск", 2015, 700], ["Nunito Sans", "гротеск", 2016, 700], ["Lunasima", "гротеск", 2023, 700], ["Akt", "гротеск", 2026, 700], ["Finlandica Text", "гротеск", 2026, 700]], "retro": [["Rubik 80s Fade", "акцидентный", 2022, 400], ["Rubik Vinyl", "акцидентный", 2022, 400], ["Rubik Iso", "акцидентный", 2022, 400], ["Days One", "гротеск", 2011, 400], ["Seymour One", "гротеск", 2012, 400], ["Kelly Slab", "акцидентный", 2011, 400], ["Prosto One", "акцидентный", 2012, 400], ["Ruslan Display", "акцидентный", 2011, 400], ["Stalinist One", "акцидентный", 2012, 400], ["Orelega One", "акцидентный", 2021, 400], ["Yeseva One", "акцидентный", 2011, 400], ["Gabriela", "антиква", 2013, 400], ["Podkova", "антиква", 2011, 700], ["Underdog", "акцидентный", 2012, 400], ["Marmelad", "гротеск", 2011, 400], ["Montserrat Alternates", "гротеск", 2012, 700], ["Yanone Kaffeesatz", "гротеск", 2010, 700], ["Press Start 2P", "акцидентный", 2012, 400], ["Bitter", "антиква", 2011, 700], ["Lobster", "акцидентный", 2010, 400]], "y2k": [["Tektur", "акцидентный", 2023, 700], ["Rubik Gemstones", "акцидентный", 2022, 400], ["Rubik Glitch Pop", "акцидентный", 2024, 400], ["Rubik Moonrocks", "акцидентный", 2022, 400], ["Pixelify Sans", "акцидентный", 2023, 700], ["Tiny5", "гротеск", 2024, 400], ["Handjet", "акцидентный", 2020, 700], ["Play", "гротеск", 2011, 700], ["Exo 2", "гротеск", 2013, 700], ["Comfortaa", "акцидентный", 2011, 700], ["Rubik Puddles", "акцидентный", 2022, 400], ["Climate Crisis", "акцидентный", 2022, 400], ["Science Gothic", "гротеск", 2025, 700], ["Sansation", "гротеск", 2025, 700], ["Kablammo", "акцидентный", 2023, 400], ["Rubik Microbe", "акцидентный", 2022, 400], ["Tuffy", "гротеск", 2025, 700], ["Montserrat Alternates", "гротеск", 2012, 700], ["Rubik Bubbles", "акцидентный", 2022, 400], ["Press Start 2P", "акцидентный", 2012, 400]], "anime": [["Dela Gothic One", "акцидентный", 2020, 400], ["Zen Maru Gothic", "гротеск", 2021, 700], ["M PLUS Rounded 1c", "гротеск", 2018, 700], ["Rubik Beastly", "акцидентный", 2021, 400], ["Rubik Storm", "акцидентный", 2022, 400], ["Zen Kurenaido", "гротеск", 2021, 400], ["Zen Antique Soft", "антиква", 2021, 400], ["Huninn", "гротеск", 2025, 400], ["Rubik Puddles", "акцидентный", 2022, 400], ["Rubik Gemstones", "акцидентный", 2022, 400], ["Rubik Glitch Pop", "акцидентный", 2024, 400], ["Kablammo", "акцидентный", 2023, 400], ["Comic Relief", "акцидентный", 2025, 700], ["Pangolin", "рукописный", 2017, 400], ["Playpen Sans", "рукописный", 2023, 700], ["Seymour One", "гротеск", 2012, 400], ["Rubik Moonrocks", "акцидентный", 2022, 400], ["Pixelify Sans", "акцидентный", 2023, 700], ["Press Start 2P", "акцидентный", 2012, 400], ["Comfortaa", "акцидентный", 2011, 700]], "doodle": [["Pangolin", "рукописный", 2017, 400], ["Playpen Sans", "рукописный", 2023, 700], ["Shantell Sans", "акцидентный", 2023, 700], ["Comic Relief", "акцидентный", 2025, 700], ["Balsamiq Sans", "акцидентный", 2020, 700], ["Rubik Doodle Shadow", "акцидентный", 2023, 400], ["Rubik Doodle Triangles", "акцидентный", 2023, 400], ["Rubik Scribble", "акцидентный", 2023, 400], ["Rubik Marker Hatch", "акцидентный", 2022, 400], ["Rubik Microbe", "акцидентный", 2022, 400], ["Rubik Puddles", "акцидентный", 2022, 400], ["Caveat", "рукописный", 2015, 700], ["Bad Script", "рукописный", 2011, 400], ["Oi", "акцидентный", 2021, 400], ["Underdog", "акцидентный", 2012, 400], ["Marmelad", "гротеск", 2011, 400], ["Bellota", "акцидентный", 2020, 700], ["Andika", "гротеск", 2011, 700], ["Comfortaa", "акцидентный", 2011, 700], ["Rubik Bubbles", "акцидентный", 2022, 400]], "tech": [["JetBrains Mono", "моно", 2020, 700], ["Geist Mono", "моно", 2024, 700], ["Martian Mono", "моно", 2022, 700], ["Fira Code", "моно", 2019, 700], ["IBM Plex Mono", "моно", 2018, 700], ["Victor Mono", "моно", 2023, 700], ["Source Code Pro", "моно", 2012, 700], ["Roboto Mono", "моно", 2025, 700], ["Cascadia Code", "гротеск", 2025, 700], ["Cascadia Mono", "гротеск", 2025, 700], ["Lilex", "моно", 2025, 700], ["Iosevka Charon", "моно", 2026, 700], ["Ubuntu Sans Mono", "моно", 2024, 700], ["Overpass Mono", "моно", 2016, 700], ["PT Mono", "моно", 2012, 400], ["Anonymous Pro", "моно", 2010, 700], ["Tektur", "акцидентный", 2023, 700], ["Handjet", "акцидентный", 2020, 700], ["Rubik Glitch", "акцидентный", 2022, 400], ["Science Gothic", "гротеск", 2025, 700]], "future": [["Unbounded", "гротеск", 2022, 700], ["Tektur", "акцидентный", 2023, 700], ["Science Gothic", "гротеск", 2025, 700], ["Sansation", "гротеск", 2025, 700], ["Exo 2", "гротеск", 2013, 700], ["Jura", "гротеск", 2011, 700], ["Advent Pro", "гротеск", 2012, 700], ["Play", "гротеск", 2011, 700], ["Russo One", "гротеск", 2012, 400], ["Days One", "гротеск", 2011, 400], ["Rubik Iso", "акцидентный", 2022, 400], ["Rubik Lines", "акцидентный", 2023, 400], ["Rubik Maze", "акцидентный", 2022, 400], ["Climate Crisis", "акцидентный", 2022, 400], ["Martian Mono", "моно", 2022, 700], ["Alumni Sans Pinstripe", "гротеск", 2022, 400], ["Montserrat Alternates", "гротеск", 2012, 700], ["Tuffy", "гротеск", 2025, 700], ["Handjet", "акцидентный", 2020, 700], ["Rubik Mono One", "гротеск", 2014, 400]], "romance": [["Cormorant Garamond", "антиква", 2016, 700], ["Cormorant", "антиква", 2016, 700], ["Cormorant Unicase", "антиква", 2016, 700], ["Cormorant SC", "антиква", 2016, 700], ["Playfair", "антиква", 2023, 700], ["Prata", "антиква", 2011, 400], ["Alice", "антиква", 2011, 400], ["Bona Nova", "антиква", 2021, 700], ["Viaoda Libre", "акцидентный", 2019, 400], ["Great Vibes", "рукописный", 2012, 400], ["Marck Script", "рукописный", 2011, 400], ["Comforter", "рукописный", 2021, 400], ["Comforter Brush", "рукописный", 2021, 400], ["Bad Script", "рукописный", 2011, 400], ["Poiret One", "акцидентный", 2012, 400], ["Yeseva One", "акцидентный", 2011, 400], ["Bellota Text", "акцидентный", 2020, 700], ["Ysabeau Infant", "гротеск", 2023, 700], ["Kurale", "антиква", 2015, 400], ["Lora", "антиква", 2011, 700]], "scrap": [["Bad Script", "рукописный", 2011, 400], ["Shantell Sans", "акцидентный", 2023, 700], ["Playpen Sans", "рукописный", 2023, 700], ["Kurale", "антиква", 2015, 400], ["Marmelad", "гротеск", 2011, 400], ["Rubik Dirt", "акцидентный", 2022, 400], ["Rubik Distressed", "акцидентный", 2022, 400], ["Rubik Wet Paint", "акцидентный", 2022, 400], ["Rubik Marker Hatch", "акцидентный", 2022, 400], ["Old Standard TT", "антиква", 2010, 700], ["Anonymous Pro", "моно", 2010, 700], ["Cousine", "моно", 2010, 700], ["Gabriela", "антиква", 2013, 400], ["Ledger", "антиква", 2012, 400], ["Comforter Brush", "рукописный", 2021, 400], ["Amatic SC", "рукописный", 2011, 700], ["Underdog", "акцидентный", 2012, 400], ["Pangolin", "рукописный", 2017, 400], ["Zen Kurenaido", "гротеск", 2021, 400], ["Caveat", "рукописный", 2015, 700]], "lux": [["Cormorant Garamond", "антиква", 2016, 700], ["Playfair Display SC", "антиква", 2012, 700], ["Bona Nova SC", "антиква", 2024, 700], ["Tenor Sans", "гротеск", 2011, 400], ["Forum", "акцидентный", 2011, 400], ["Prata", "антиква", 2011, 400], ["Viaoda Libre", "акцидентный", 2019, 400], ["Poiret One", "акцидентный", 2012, 400], ["Spectral", "антиква", 2017, 700], ["Spectral SC", "антиква", 2017, 700], ["EB Garamond", "антиква", 2011, 700], ["Libertinus Serif Display", "акцидентный", 2025, 400], ["Brygada 1918", "антиква", 2021, 700], ["Literata", "антиква", 2018, 700], ["STIX Two Text", "антиква", 2021, 700], ["Ysabeau", "гротеск", 2023, 700], ["Ysabeau SC", "гротеск", 2023, 700], ["Raleway", "гротеск", 2012, 700], ["Alumni Sans Pinstripe", "гротеск", 2022, 400], ["Oranienbaum", "антиква", 2012, 400]], "cinema": [["Old Standard TT", "антиква", 2010, 700], ["Bona Nova", "антиква", 2021, 700], ["Brygada 1918", "антиква", 2021, 700], ["Vollkorn SC", "антиква", 2017, 700], ["Alegreya SC", "антиква", 2011, 700], ["Libertinus Serif", "антиква", 2025, 700], ["Gentium Book Plus", "антиква", 2022, 700], ["Forum", "акцидентный", 2011, 400], ["Ruslan Display", "акцидентный", 2011, 400], ["Alumni Sans", "гротеск", 2021, 700], ["Alumni Sans SC", "гротеск", 2025, 700], ["Fira Sans Extra Condensed", "гротеск", 2016, 700], ["Cuprum", "гротеск", 2012, 700], ["Yanone Kaffeesatz", "гротеск", 2010, 700], ["PT Sans Narrow", "гротеск", 2010, 700], ["Ubuntu Condensed", "гротеск", 2011, 400], ["Roboto Condensed", "гротеск", 2012, 700], ["Cousine", "моно", 2010, 700], ["Prata", "антиква", 2011, 400], ["Piazzolla", "антиква", 2020, 700]], "expert": [["Golos Text", "гротеск", 2023, 700], ["Geologica", "гротеск", 2023, 700], ["Commissioner", "гротеск", 2020, 700], ["Libre Franklin", "гротеск", 2016, 700], ["Overpass", "гротеск", 2016, 700], ["Fira Sans", "гротеск", 2014, 700], ["Ubuntu", "гротеск", 2010, 700], ["PT Sans", "гротеск", 2010, 700], ["Source Sans 3", "гротеск", 2021, 700], ["Arsenal", "гротеск", 2016, 700], ["Scada", "гротеск", 2012, 700], ["Didact Gothic", "гротеск", 2011, 400], ["Istok Web", "гротеск", 2011, 700], ["Gidole", "гротеск", 2025, 400], ["Mulish", "гротеск", 2011, 700], ["Raleway", "гротеск", 2012, 700], ["Alegreya Sans", "гротеск", 2013, 700], ["Libertinus Sans", "гротеск", 2025, 700], ["Ysabeau Office", "гротеск", 2023, 700], ["Moderustic", "гротеск", 2024, 700]], "grunge": [["Rubik Wet Paint", "акцидентный", 2022, 400], ["Rubik Dirt", "акцидентный", 2022, 400], ["Rubik Distressed", "акцидентный", 2022, 400], ["Rubik Burned", "акцидентный", 2022, 400], ["Rubik Glitch", "акцидентный", 2022, 400], ["Rubik Broken Fax", "акцидентный", 2023, 400], ["Rubik Beastly", "акцидентный", 2021, 400], ["Rubik Storm", "акцидентный", 2022, 400], ["Rubik Marker Hatch", "акцидентный", 2022, 400], ["Dela Gothic One", "акцидентный", 2020, 400], ["Oi", "акцидентный", 2021, 400], ["Climate Crisis", "акцидентный", 2022, 400], ["Stalinist One", "акцидентный", 2012, 400], ["Seymour One", "гротеск", 2012, 400], ["Alumni Sans Collegiate One", "гротеск", 2022, 400], ["Kablammo", "акцидентный", 2023, 400], ["Rubik Mono One", "гротеск", 2014, 400], ["Russo One", "гротеск", 2012, 400], ["Comforter Brush", "рукописный", 2021, 400], ["Handjet", "акцидентный", 2020, 700]], "eco": [["Comfortaa", "акцидентный", 2011, 700], ["Bellota", "акцидентный", 2020, 700], ["Bellota Text", "акцидентный", 2020, 700], ["Kurale", "антиква", 2015, 400], ["Gabriela", "антиква", 2013, 400], ["Lora", "антиква", 2011, 700], ["Alegreya", "антиква", 2011, 700], ["Alegreya Sans", "гротеск", 2013, 700], ["Marmelad", "гротеск", 2011, 400], ["Philosopher", "гротеск", 2011, 700], ["Andika", "гротеск", 2011, 700], ["Ysabeau Infant", "гротеск", 2023, 700], ["Zen Maru Gothic", "гротеск", 2021, 700], ["Literata", "антиква", 2018, 700], ["Piazzolla", "антиква", 2020, 700], ["Pangolin", "рукописный", 2017, 400], ["M PLUS Rounded 1c", "гротеск", 2018, 700], ["Bad Script", "рукописный", 2011, 400], ["Nunito", "гротеск", 2012, 700], ["Caveat", "рукописный", 2015, 700]], "kk": [["Dela Gothic One", "акцидентный", 2020, 400], ["Days One", "гротеск", 2011, 400], ["Rubik Mono One", "гротеск", 2014, 400], ["Russo One", "гротеск", 2012, 400], ["Onest", "гротеск", 2023, 700], ["Geologica", "гротеск", 2023, 700], ["Inter Tight", "гротеск", 2022, 700], ["Montserrat Alternates", "гротеск", 2012, 700], ["Tektur", "акцидентный", 2023, 700], ["Seymour One", "гротеск", 2012, 400], ["Climate Crisis", "акцидентный", 2022, 400], ["Golos Text", "гротеск", 2023, 700], ["Wix Madefor Display", "гротеск", 2023, 700], ["Rubik", "гротеск", 2015, 700], ["Exo 2", "гротеск", 2013, 700], ["Commissioner", "гротеск", 2020, 700], ["Akt", "гротеск", 2026, 700], ["Pliant", "гротеск", 2026, 700], ["Science Gothic", "гротеск", 2025, 700], ["Finlandica Headline", "гротеск", 2026, 700]], "season": [["Yeseva One", "акцидентный", 2011, 400], ["Great Vibes", "рукописный", 2012, 400], ["Marck Script", "рукописный", 2011, 400], ["Comforter", "рукописный", 2021, 400], ["Pattaya", "гротеск", 2016, 400], ["Ruslan Display", "акцидентный", 2011, 400], ["Kelly Slab", "акцидентный", 2011, 400], ["Rubik Gemstones", "акцидентный", 2022, 400], ["Rubik Puddles", "акцидентный", 2022, 400], ["Rubik Doodle Shadow", "акцидентный", 2023, 400], ["Rubik Moonrocks", "акцидентный", 2022, 400], ["Rubik Beastly", "акцидентный", 2021, 400], ["Rubik Microbe", "акцидентный", 2022, 400], ["Kablammo", "акцидентный", 2023, 400], ["Comic Relief", "акцидентный", 2025, 700], ["Playpen Sans", "рукописный", 2023, 700], ["Cormorant Unicase", "антиква", 2016, 700], ["Underdog", "акцидентный", 2012, 400], ["Bellota", "акцидентный", 2020, 700], ["Orelega One", "акцидентный", 2021, 400]]};
const READY=["ios","romance","tech","anime","retro","kk"]; // к выпуску 30.10, остальные — «скоро»
const CONTENT=[
 ["png","PNG без фона","стикеры, иконки, стрелки, рамки",{pc:"PNG",ph:"PNG"}],
 ["bg","Фоны и текстуры","бумага, градиенты, паттерны",{pc:"JPG · 9:16 и 16:9",ph:"JPG · 9:16 и 16:9"}],
 ["ov","Оверлеи","блики, пыль, плёнка, частицы",{pc:"MOV · прозрачный · 9:16 и 16:9",ph:"MP4 · на чёрном · 9:16 и 16:9"}],
 ["an","Анимированные","стикеры и стрелки в движении",{pc:"MOV · прозрачный",ph:"MP4 · на зелёном"}],
 ["tr","Переходы","видео-переходы в стиле",{pc:"MOV · прозрачный · 9:16 и 16:9",ph:"MP4 · на зелёном · 9:16 и 16:9"}],
 ["tx","Плашки и титры","заголовки, цитаты, списки",{pc:"MOGRT",ph:"PNG + MP4"}],
 ["mu","Музыка по настроению","подборка треков под стиль",{pc:"ссылки",ph:"ссылки"}]
];
// черновик: цены и условия сверить на сайтах перед выпуском
const SVC=[
 {n:"Jitter",u:"https://jitter.video",c:"motion",t:["animtext","animlogo"],p:["ПК","браузер"],w:"Моушн-дизайн в браузере, как облегчённый After Effects. 400+ бесплатных шаблонов.",fr:"Шаблоны, экспорт видео, GIF и Lottie в 720p, 30 fps",pd:"Pro: 1080p и 60 fps, ProRes, WebM. Max: прозрачный фон, 4K",tip:"Быстро собрать анимированную инфографику или плашку, когда After Effects — слишком долго.",pick:1},
 {n:"Brik",u:"https://brik.space",c:"motion",t:["animtext","animlogo"],p:["ПК","браузер"],w:"Описываешь идею, ИИ собирает под неё мини-инструмент с ползунками: кинетическая типографика, логотипы, 3D.",fr:"80 кредитов в месяц (до 20 в день), экспорт картинки и видео",pd:"$15 или $50 в месяц: рендер видео, без логотипа Brik, экспорт кода",tip:"Загляни в галерею: чужую работу можно взять и переделать под своего клиента."},
 {n:"Rive",u:"https://rive.app",c:"motion",t:["animlogo"],p:["ПК","браузер"],w:"Интерактивная векторная анимация: персонажи, иконки, кнопки.",fr:"Есть бесплатный тариф",pd:"Платные тарифы для коммерции и команд",tip:"Для анимационных рилсов с персонажами."},
 {n:"LottieFiles",u:"https://lottiefiles.com",c:"motion",t:["animtext","stickers"],p:["ПК","телефон","браузер"],w:"Огромная библиотека готовых лёгких анимаций: иконки, стикеры, эмодзи.",fr:"Большая бесплатная библиотека, скачивание GIF и MP4",pd:"Pro: больше форматов и редактирование",tip:"Ищи по-английски: «arrow», «heart», «loading»."},
 {n:"Pikimov",u:"https://pikimov.com",c:"motion",t:["animtext"],p:["ПК","браузер"],w:"Бесплатный моушн-редактор в браузере с ключами и слоями.",fr:"Бесплатно",pd:"Подписки нет",tip:"Когда нет After Effects под рукой."},
 {n:"Canva",u:"https://www.canva.com",c:"motion",t:["animtext","mockup","stickers"],p:["ПК","телефон"],w:"Шаблоны, анимации текста, стикеры, мокапы.",fr:"Много шаблонов и элементов",pd:"Pro: премиум-элементы, удаление фона, бренд-набор",tip:"Обложки рилсов и мокапы для портфолио за 5 минут."},
 {n:"Google Fonts",u:"https://fonts.google.com/?subset=cyrillic",c:"fonts",t:["font"],p:["ПК","телефон","браузер"],w:"Бесплатные шрифты для коммерции. Фильтр «Cyrillic» — сразу с кириллицей и латиницей.",fr:"Все шрифты бесплатно, можно в коммерцию",pd:"Подписки нет",tip:"Первое место, где искать шрифт для клиента: лицензия чистая.",pick:1},
 {n:"Fontesk",u:"https://fontesk.com",c:"fonts",t:["font"],p:["ПК","браузер"],w:"Подборки бесплатных шрифтов, есть раздел кириллицы.",fr:"Бесплатно",pd:"Подписки нет",tip:"У каждого шрифта смотри лицензию и проверь, есть ли латиница."},
 {n:"WhatTheFont",u:"https://www.myfonts.com/pages/whatthefont",c:"fonts",t:["findfont"],p:["ПК","телефон","браузер"],w:"Загружаешь скрин, сервис находит шрифт.",fr:"Бесплатно",pd:"Платные сами шрифты в магазине MyFonts",tip:"Нашёл платный шрифт? Ищи похожий бесплатный в Google Fonts.",pick:1},
 {n:"Font Squirrel Matcherator",u:"https://www.fontsquirrel.com/matcherator",c:"fonts",t:["findfont"],p:["ПК","браузер"],w:"Определение шрифта по картинке, подсказывает бесплатные аналоги.",fr:"Бесплатно",pd:"Подписки нет",tip:"Второй вариант, если WhatTheFont не узнал."},
 {n:"YouTube Audio Library",u:"https://studio.youtube.com",c:"music",t:["music"],p:["ПК","браузер"],w:"Музыка и звуки от YouTube.",fr:"Бесплатно",pd:"Подписки нет",tip:"Безопасно для YouTube; для Reels проверь условия трека."},
 {n:"Uppbeat",u:"https://uppbeat.io",c:"music",t:["music"],p:["ПК","телефон","браузер"],w:"Музыка для блогеров с понятной лицензией.",fr:"Ограниченное число скачиваний в месяц",pd:"Premium: без лимита",tip:"Удобный поиск по настроению."},
 {n:"Artlist",u:"https://artlist.io",c:"music",t:["music","sfx"],p:["ПК","браузер"],w:"Профессиональная музыка и SFX, лицензия для коммерции.",fr:"Только прослушивание",pd:"Годовая подписка",tip:"Когда клиент платит за рекламный ролик: лицензия покрывает коммерцию.",pick:1},
 {n:"Epidemic Sound",u:"https://www.epidemicsound.com",c:"music",t:["music","sfx"],p:["ПК","телефон","браузер"],w:"Музыка и звуки, интеграция с соцсетями.",fr:"Пробный период",pd:"Подписка для личных и для бизнеса",tip:"Есть стемы: можно убрать вокал или барабаны."},
 {n:"Freesound",u:"https://freesound.org",c:"sfx",t:["sfx"],p:["ПК","браузер"],w:"Огромная база звуков от сообщества.",fr:"Бесплатно, но у каждого звука своя лицензия",pd:"Подписки нет",tip:"Фильтр по лицензии CC0: можно без указания автора."},
 {n:"Mixkit",u:"https://mixkit.co",c:"sfx",t:["sfx","stock","music"],p:["ПК","браузер"],w:"Бесплатные звуки, музыка, видео и шаблоны.",fr:"Бесплатно",pd:"Подписки нет",tip:"Быстрые «вжух» и «клик» для переходов.",pick:1},
 {n:"Pixabay",u:"https://pixabay.com",c:"stock",t:["stock","music","sfx"],p:["ПК","телефон","браузер"],w:"Видео, фото, музыка и звуки.",fr:"Всё бесплатно, можно в коммерцию без указания автора",pd:"Подписки нет",tip:"Не продавай файлы Pixabay как есть: только внутри своего ролика.",pick:1},
 {n:"Pexels",u:"https://www.pexels.com",c:"stock",t:["stock"],p:["ПК","телефон","браузер"],w:"Видео и фото, есть приложение для телефона.",fr:"Бесплатно",pd:"Подписки нет",tip:"Хорошие вертикальные футажи: фильтр «Portrait»."},
 {n:"Coverr",u:"https://coverr.co",c:"stock",t:["stock"],p:["ПК","браузер"],w:"Бесплатные видео-футажи.",fr:"Бесплатно",pd:"Подписки нет",tip:"Фоны для текста и интро."},
 {n:"CloudConvert",u:"https://cloudconvert.com",c:"convert",t:["convert"],p:["ПК","телефон","браузер"],w:"Конвертирует почти любой формат: видео, аудио, картинки.",fr:"Ограниченное число конвертаций в день",pd:"Пакеты и подписка без лимита",tip:"MOV с iPhone, который не открывается, → MP4.",pick:1},
 {n:"ezgif",u:"https://ezgif.com",c:"convert",t:["convert","gif"],p:["ПК","телефон","браузер"],w:"GIF, WebM, обрезка и сжатие маленьких роликов.",fr:"Бесплатно",pd:"Подписки нет",tip:"Сделать GIF-превью работы для клиента."},
 {n:"HandBrake",u:"https://handbrake.fr",c:"convert",t:["compress"],p:["ПК"],w:"Программа для сжатия видео без заметной потери качества.",fr:"Бесплатно",pd:"Подписки нет",tip:"Ролик весит 2 ГБ, а нужно отправить в Telegram: сюда.",pick:1},
 {n:"Photoroom",u:"https://www.photoroom.com",c:"bg",t:["removebg"],p:["ПК","телефон"],w:"Удаление фона с фото, готовые фоны.",fr:"Базовые функции",pd:"Pro: без ограничений, пакетная обработка",tip:"Самый быстрый вариант с телефона.",pick:1},
 {n:"remove.bg",u:"https://www.remove.bg",c:"bg",t:["removebg"],p:["ПК","браузер"],w:"Удаление фона с фото одним кликом.",fr:"Превью в низком разрешении",pd:"Кредиты за картинки в высоком качестве",tip:"Для PNG-стикеров из фото клиента."},
 {n:"CapCut",u:"https://www.capcut.com",c:"bg",t:["removebg","subs","voice"],p:["ПК","телефон"],w:"Вырезать человека из видео, автосубтитры, шумоподавление.",fr:"Монтаж, автосубтитры, базовое удаление фона",pd:"Pro: часть эффектов и ИИ-функций",tip:"Вырезать человека из видео без зелёного фона.",pick:1},
 {n:"Adobe Podcast Enhance",u:"https://podcast.adobe.com/enhance",c:"voice",t:["voice"],p:["ПК","браузер"],w:"Делает голос «студийным»: убирает шум и эхо.",fr:"Ограничение по длине файлов",pd:"Premium: длиннее и больше",tip:"Говорящая голова записана в ванной: спасает.",pick:1},
 {n:"Upscayl",u:"https://upscayl.org",c:"upscale",t:["upscale"],p:["ПК"],w:"Увеличивает качество картинок с помощью ИИ.",fr:"Бесплатно, open source",pd:"Подписки нет",tip:"Логотип клиента пришёл маленьким."},
 {n:"Topaz Video",u:"https://www.topazlabs.com",c:"upscale",t:["upscale"],p:["ПК"],w:"Апскейл и стабилизация видео, плавное слоумо.",fr:"Пробная версия",pd:"Платная лицензия",tip:"Когда исходник клиента в 720p, а нужен 4K."},
 {n:"Coolors",u:"https://coolors.co",c:"color",t:["palette"],p:["ПК","телефон","браузер"],w:"Генератор палитр.",fr:"Бесплатно",pd:"Pro: больше палитр и экспортов",tip:"Собери палитру по фото клиента."},
 {n:"Adobe Color",u:"https://color.adobe.com",c:"color",t:["palette"],p:["ПК","браузер"],w:"Палитры и правила сочетания цветов.",fr:"Бесплатно",pd:"Входит в подписку Adobe",tip:"Палитру можно сразу забрать в Премьер через библиотеки CC."},
 {n:"Rotato",u:"https://rotato.app",c:"mockup",t:["mockup"],p:["ПК"],w:"Анимированные 3D-мокапы телефона и ноутбука.",fr:"Пробная версия",pd:"Платная лицензия (Mac)",tip:"Красиво показать рилс в телефоне для портфолио."},
 {n:"ElevenLabs",u:"https://elevenlabs.io",c:"ai",t:["voice"],p:["ПК","телефон","браузер"],w:"ИИ-озвучка и перевод голоса.",fr:"Ограниченное число символов в месяц",pd:"Подписки от базовой до студийной",tip:"Озвучка для анимационных рилсов и туториалов."},
 {n:"Adobe Firefly",u:"https://firefly.adobe.com",c:"ai",t:["aiimg"],p:["ПК","браузер"],w:"Генерация и расширение картинок, безопасно для коммерции.",fr:"Ограниченные кредиты",pd:"Входит в подписку Adobe",tip:"Расширить вертикальный кадр в горизонтальный."},
 {n:"Kling",u:"https://klingai.com",c:"ai",t:["aivideo"],p:["ПК","телефон","браузер"],w:"Генерация видео по тексту и картинке.",fr:"Ежедневные бесплатные кредиты",pd:"Подписка: больше кредитов и качество",tip:"Оживить фото клиента для интро."},
 {n:"Pinterest",u:"https://www.pinterest.com",c:"refs",t:["refs"],p:["ПК","телефон"],w:"Референсы и насмотренность.",fr:"Бесплатно",pd:"Подписки нет",tip:"Только для вдохновения: картинки оттуда в ролик клиента не берём."},
 {n:"Savee",u:"https://savee.it",c:"refs",t:["refs"],p:["ПК","браузер"],w:"Доска референсов для дизайнеров и моушн-дизайнеров.",fr:"Бесплатно",pd:"Pro: приватные доски",tip:"Собери мудборд для клиента и отправь ссылкой."}
];
const CATS=[["motion","Анимация и моушн"],["fonts","Шрифты"],["music","Музыка"],["sfx","Звуки"],["stock","Стоки"],["convert","Конвертеры и сжатие"],["bg","Удалить фон"],["voice","Голос"],["upscale","Качество"],["color","Цвет"],["mockup","Мокапы"],["ai","ИИ"],["refs","Референсы"]];
const TASKS=[["removebg","Убрать фон"],["findfont","Узнать шрифт по картинке"],["font","Найти шрифт (кириллица + латиница)"],["animtext","Анимировать текст или плашку"],["animlogo","Анимировать логотип"],["music","Найти музыку"],["sfx","Найти звук"],["stock","Найти футаж"],["compress","Сжать видео"],["convert","Сменить формат"],["voice","Улучшить или сделать голос"],["upscale","Повысить качество"],["palette","Собрать палитру"],["mockup","Мокап для портфолио"],["aivideo","Сгенерировать видео"],["aiimg","Сгенерировать или расширить картинку"],["refs","Собрать референсы"],["stickers","Готовые стикеры"],["subs","Автосубтитры"],["gif","Сделать GIF"]];
const CHEATS=[
 {id:"black",n:"Оверлей на чёрном фоне",d:"блики, пыль, плёнка",ph:1,steps:["Добавь клип оверлея поверх видео: «Наложение» → «Добавить наложение».","Растяни оверлей на весь кадр.","«Смешивание» → режим «Экран». Чёрный исчезнет, останутся блики.","Убавь непрозрачность до 60–80%, если эффект слишком яркий."]},
 {id:"green",n:"Анимация на зелёном фоне",d:"стикеры, стрелки, переходы",ph:1,steps:["Добавь клип поверх видео через «Наложение».","«Удалить фон» → «Хромакей».","Пипеткой ткни в зелёный, «Интенсивность» около 20–30.","Если по краям зелёная кайма — подними «Тени» или «Края»."]},
 {id:"font",n:"Свой шрифт на телефон",d:"iPhone и Android",ph:1},
 {id:"curve",n:"Плавность в CapCut",d:"кривые скорости и анимации",ph:1},
 {id:"fixph",n:"Исправить в CapCut",d:"стабилизация, рамки, слоумо, мерцание",ph:1},
 {id:"move",n:"Перенос CapCut ↔ Премьер",d:"что переносится, а что нет",ph:1,pc:1},
 {id:"frames",n:"Чёрные рамки после стабилизации",d:"почему появляются и как убрать",pc:1,steps:["Выдели клип, «Эффекты» → «Стабилизатор деформации» (Warp Stabilizer).","Дождись анализа.","«Кадрирование» → «Стабилизация, обрезка, автомасштаб». Рамки уйдут.","Если кадр сильно увеличился — снизь «Сглаживание» до 15–25%.","В плагине КК это одна кнопка: вкладка «Исправить» → «Стабилизировать без рамок»."]},
 {id:"sd",n:"Саунд-дизайн для акцента",d:"куда ставить звук и какой громкости",pc:1,ph:1},
 {id:"fontpair",n:"Пара шрифтов: основной + акцентный",d:"чтобы акцент читался, кириллица и латиница",pc:1,ph:1},
 {id:"flicker",n:"Мерцание от ламп",d:"что делать, если кадр «моргает»",pc:1}
];
const CHECKS=[["Размер под площадку","Вертикаль 1080×1920 — Reels, TikTok, Shorts · горизонталь 1920×1080 или 4K — YouTube, реклама, презентации"],["Частота кадров как у исходника","Обычно 25 или 30 кадров в секунду"],["H.264 или HEVC, битрейт 10–20 Мбит/с","Иначе площадка пережмёт и будет мыло"],["Текст и субтитры в безопасной зоне","Вертикаль: не под ником, описанием и кнопками · горизонталь: не у самого края, внизу не под плеером"],["Голос громче музыки и звуков","SFX не перебивают речь"],["Нет опечаток в титрах","Прочитай вслух каждую плашку"],["Нет чёрных рамок по краям","Особенно после стабилизации и увеличения"],["Обложка готова","Первый кадр или отдельная картинка"],["Файл назван понятно","Клиент_Ролик_v2.mp4, а не final_final3"]];
const BRIEF=["Для чего ролик и где выйдет (Reels, TikTok, YouTube, реклама)?","Какой стиль ближе: покажи 2–3 стиля из нашего пака или референсы","Есть ли брендбук: цвета, шрифты, логотип?","Музыка: какое настроение, есть ли трек клиента, нужна ли лицензия?","Нужны ли субтитры и в каком стиле? На каком языке (русский, английский)?","Длительность и формат: вертикаль, горизонталь или обе версии (адаптация — отдельная стоимость?)","Срок первой версии и финала","Сколько правок входит в стоимость и сколько стоит дополнительная","Кто принимает работу и в каком канале общаемся"];
const TUTS=[["Установка плагина","pc","1:30"],["Текст и плавность","pc","2:00"],["Субтитры","pc","1:40"],["Переходы","pc","1:20"],["Исправить","pc","1:40"],["Анимация","pc","2:00"],["Вставки и наборы","both","1:30"],["CapCut: оверлеи и хромакей","ph","2:00"],["Справочник","both","1:00"]];
// готовые материалы программы, которые относятся к работе на устройстве (ищем по названию в S.mats, ссылки живые)
const EXIST=[["Гайд «Горячие клавиши»","pc","Premiere Pro, Mac и Windows"],["Подборка трендовых шрифтов 2026","both",""],["Подборка вкусных трендовых шрифтов","both",""],["Подборка сервисов с музыкой","both",""],["Подборка нейросетей 2026","both",""],["Плашки под текст","both",""],["Вертикальная рамка","both",""],["Горизонтальная рамка","both",""]];
const PLUG={
 mont:{n:"КК · Монтаж",v:"1.0",tabs:[
  ["Текст",["Появление: pop, отскок, выезд с размытием, по буквам, по словам, печатная машинка, маска-шторка","Акценты: маркер, подчёркивание, обвести кружком, зачеркнуть, тряска слова","Плашки (MOGRT): цитата, заголовок рилса, список, цифра, ник, «подпишись»"]],
  ["Субтитры",["Берёт текст из встроенного распознавания Премьера (русский и английский), для вертикали и горизонтали","10+ стилей: подсветка слова, слово за словом, караоке, капс с обводкой, минимал","Сам переносит строки и держит в безопасной зоне"]],
  ["Переходы",["Зум-рывок, смаз, вращение, вспышка, glitch, тряска, шторка, растягивание","Одна кнопка на стык двух клипов, плавность уже настроена","Переход через вставку из библиотеки"]],
  ["Плавность",["Кнопки на выделенные ключи: плавно, резкий старт, резкий финиш, пружина, отскок, «как в iOS»","Наезд и отъезд камеры, панорама, «дыхание» кадра"]],
  ["Исправить",["Стабилизировать без чёрных рамок","Убрать рамки: подогнать под 9:16","Мерцание от ламп","Слоумо 50% / 25% с плавным переходом скорости","Мягкая склейка по звуку: без щелчка на стыке"]],
  ["Вставки",["Вся библиотека стилевых наборов прямо в Премьере","Фильтр по стилю и типу, перетащила на таймлайн","Обновляется сама"]],
  ["Секвенция",["В один клик: вертикаль 9:16 и 4:5, горизонталь 16:9 (1080p и 4K), квадрат 1:1 · 25 или 30 кадров","Все анимации, плавность и камера одинаково работают в вертикали и горизонтали","Скоро: сетка безопасных зон (Reels, TikTok, Shorts, YouTube) и пресеты экспорта"]]
 ],news:[["1.0","Первый выпуск"]]},
 anim:{n:"КК · Анимация",v:"1.0",tabs:[
  ["Покадровое",["«Через кадр» (stop-motion) на любой клип","Дёрганость и «рисованная» тряска контура"]],
  ["Циклы",["Качание, парение, пульс, вращение, мигание — готовые ключи с повтором"]],
  ["Появление",["Объекты по очереди (лесенкой)","Сжатие и растяжение при прыжке","Движение по дуге"]]
 ],news:[["1.0","Первый выпуск: 10 механик"]]}
};

/* ---------- состояние и помощники ---------- */
let dev=load("kk_pk_dev")||"pc",client="",ct="png",mode="task";
const e=s=>esc(String(s));
const loaded=new Set();
function loadF20(id){if(loaded.has(id))return;loaded.add(id);const l=document.createElement("link");l.rel="stylesheet";
 l.href="https://fonts.googleapis.com/css2?"+F20[id].map(f=>"family="+f[0].replace(/ /g,"+")+(f[3]!==400?":wght@"+f[3]:"")).join("&")+"&display=swap";document.head.appendChild(l)}
const H=p=>"#mat/pk"+(p?"/"+p:"");
const plat=s=>dev==="pc"?s.p.some(x=>x==="ПК"||x==="браузер"):s.p.includes("телефон");
const devOk=d=>d==="both"||d===dev;
const devName=()=>dev==="pc"?"Компьютер":"Телефон";
const fam=f=>`'${f}',var(--f-display)`;
function seg(){return `<div class="pk-seg" role="group" aria-label="Где монтируешь"><button onclick="PK.dev('pc')" aria-pressed="${dev==="pc"}">Компьютер</button><button onclick="PK.dev('ph')" aria-pressed="${dev==="ph"}">Телефон</button></div>`}
function soon(t){if(typeof toast==="function")toast(t);else alert(t)}
function mat(title){return (S.mats||[]).find(m=>m.t===title)}
function card(s){return `<article class="pk-svc"><div class="hd"><b>${e(s.n)}${s.pick?'<span class="pk-pick">ВЫБОР БУШИ</span>':""}</b><span class="pk-plats">${s.p.map(x=>`<span class="pk-plat">${e(x)}</span>`).join("")}</span></div>
 <p class="what">${e(s.w)}</p>
 <div class="pk-tiers"><div class="f"><i>Бесплатно</i>${e(s.fr)}</div><div class="p"><i>Подписка</i>${e(s.pd)}</div></div>
 <p class="pk-tip"><em>Когда брать:</em> ${e(s.tip)}</p>
 <a class="pk-btn ghost" style="justify-self:start;font-size:13px;padding:8px 12px" href="${e(s.u)}" target="_blank" rel="noopener">Открыть сайт ↗</a></article>`}

/* ---------- экраны ---------- */
const V={
home(){const pc=dev==="pc";
 const cards=pc?[["plugin/mont","Pr","Плагин «КК · Монтаж»","Текст, субтитры, переходы, плавность, исправления · вертикаль и горизонталь","v1.0",1],["plugin/anim","Ae","Плагин «КК · Анимация»","Для анимационных рилсов","v1.0"],["styles","▦","Стилевые наборы","16 стилей · вертикаль 9:16 и горизонталь 16:9",""],["svc","↗","Справочник сервисов","По задаче или по разделам · бесплатно и подписка",""],["cheats","✎","Шпаргалки","Исправления, саунд-дизайн, шрифты, перенос",""],["checks","✓","Чек-лист перед сдачей","Экспорт и сдача клиенту",""],["brief","?","Бриф клиента","Что спросить до монтажа",""],["tuts","▶","Туториалы","Короткие видео по каждому инструменту",""]]
 :[["styles","▦","Стилевые наборы для CapCut","PNG, MP4 на чёрном и зелёном · 9:16 и 16:9",""],["svc","↗","Справочник сервисов","Только то, что работает с телефона",""],["cheats","✎","Шпаргалки CapCut","Оверлеи, хромакей, шрифт, плавность",""],["checks","✓","Чек-лист перед сдачей","Экспорт и сдача клиенту",""],["brief","?","Бриф клиента","Что спросить до монтажа",""],["tuts","▶","Туториалы","Для телефона",""]];
 const ex=EXIST.filter(x=>devOk(x[1]));
 return {t:"Пак режиссёра монтажа",v:`<div class="pk-author">ВИДИШЬ ТОЛЬКО ТЫ (АВТОР) · ученицы пока не видят этот раздел</div>
 <h1 class="h">Пак режиссёра монтажа</h1><p class="sub">Сначала руками, теперь быстрее. Выбери, где монтируешь: покажу только нужное.</p>
 ${seg()}
 <div class="pk-news"><b>Что нового</b><span class="pk-muted">Первый выпуск пака.</span></div>
 <div class="pk-grid">${cards.map(c=>`<a class="pk-card${c[5]?" wide":""}" href="${H(c[0])}"><span class="top"><span class="ic">${c[1]}</span>${c[4]?`<span class="pk-badge">${e(c[4])}</span>`:""}</span><b>${e(c[2])}</b><small>${e(c[3])}</small></a>`).join("")}</div>
 <div class="sec-t">Уже есть в программе · ${pc?"для компьютера":"для телефона"}</div>
 <div class="pk-list">${ex.map(x=>{const m=mat(x[0]);return `<a class="pk-row" ${m?`href="${e(m.u)}" target="_blank" rel="noopener"`:`href="#mat"`}><span class="ic">${m&&/PDF/.test(m.d)?"PDF":"↓"}</span><span class="tx"><b>${e(x[0])}</b><small>${e(x[2]||(m&&m.d)||"")}${m?"":" · не нашла в материалах"}</small></span><span class="arr">↗</span></a>`}).join("")}</div>
 <div class="pk-box"><h3>Чего не хватает в паке?</h3><p class="pk-muted" style="margin:0">Напиши, что добавить. Лучшие идеи появятся в следующем обновлении.</p><button class="pk-btn ghost" onclick="PK.soon('Форма идей появится к выпуску: идея будет приходить в бота')">Предложить</button></div>`}},

plugin(id){const p=PLUG[id];if(!p)return null;
 return {t:p.n,v:`<h1 class="h">${e(p.n)}</h1><p class="sub">Плагин для Premiere Pro 2019–2026, Mac и Windows. Для вертикали и горизонтали. Работает по твоему нику из приложения.</p>
 <div class="pk-btns">${p.zip?`<a class="pk-btn" href="${e(p.zip)}">Скачать установщик</a>`:`<button class="pk-btn" onclick="PK.soon('Скоро здесь будет установщик')">Скачать установщик</button>`}<button class="pk-btn ghost" onclick="PK.key()">Получить ключ</button></div>
 <div class="pk-box" id="pk-key" hidden></div>
 <div class="pk-box"><h3>Как установить</h3><ol class="pk-steps"><li>Скачай архив и распакуй.</li><li>Открой «Установить КК» (на Mac) или «Установить КК.bat» (на Windows). Премьер должен быть закрыт.</li><li>Открой Премьер → «Окно» → «Расширения» → «${e(p.n)}».</li><li>Введи свой ник из приложения. Всё.</li></ol><p class="pk-muted" style="margin:0">Обновления приходят сами: в плагине появится плашка «Обновить».</p></div>
 <div class="sec-t">Что умеет</div>
 ${p.tabs.map(t=>`<details><summary>${e(t[0])}</summary><ul>${t[1].map(x=>`<li>${e(x)}</li>`).join("")}</ul></details>`).join("")}
 <div class="sec-t">Что нового</div>
 <div class="pk-list">${p.news.map(n=>`<div class="pk-row"><span class="ic">${e(n[0])}</span><span class="tx"><small>${e(n[1])}</small></span></div>`).join("")}</div>
 <a class="pk-btn ghost" href="${H("tuts")}">Смотреть туториалы</a>`}},

styles(){const pc=dev==="pc";const clients=[...new Set(STYLES.flatMap(s=>s.for))];
 const list=STYLES.filter(s=>!client||s.for.includes(client));
 return {t:"Стилевые наборы",v:`<h1 class="h">Стилевые наборы</h1><p class="sub">${pc?"Форматы для Премьера: PNG, MOV с прозрачностью, MOGRT.":"Форматы для CapCut: PNG, MP4 на чёрном и зелёном фоне."} Всё в двух ориентациях: вертикаль 9:16 и горизонталь 16:9. Шрифты — с кириллицей и латиницей.</p>
 ${seg()}
 <div class="sec-t">Подобрать под клиента</div>
 <div class="pk-chips"><button class="pk-chip" onclick="PK.client('')" aria-pressed="${!client}">Все</button>${clients.map(c=>`<button class="pk-chip" onclick="PK.client('${e(c)}')" aria-pressed="${client===c}">${e(c)}</button>`).join("")}</div>
 <div class="pk-styles">${list.map(s=>{const so=!READY.includes(s.id);return `<a class="pk-st" href="${H("style/"+s.id)}"><span class="sw" style="background:${s.bg};color:${s.fg};font-family:${fam(s.f[0])}">Аа Aa ${s.em}</span><span class="meta"><b>${e(s.n)} ${so?'<span class="pk-badge soon">СКОРО</span>':""}</b><small>${e(s.for.join(", "))}</small></span></a>`}).join("")}</div>`}},

style(id){const s=STYLES.find(x=>x.id===id);if(!s)return null;const pc=dev==="pc",so=!READY.includes(id),c=CONTENT.find(x=>x[0]===ct)||CONTENT[0];
 const items=c[0]==="mu"?["Нежное утро","Лёгкий вайб","Драйв","Кинематографично","Для говорящей головы","Под тренд"]:s.ex.split(", ").concat(["вариант 2","вариант 3","вариант 4"]).slice(0,9);
 const fmt=pc?c[3].pc:c[3].ph;
 const cls=c[0]==="mu"||c[0]==="bg"?"":(c[0]==="ov"&&!pc?"pk-black":((c[0]==="an"||c[0]==="tr")&&!pc?"pk-green":"pk-checker"));
 return {t:s.n,v:`<div class="pk-st"><span class="sw" style="height:130px;background:${s.bg};color:${s.fg};font-family:${fam(s.f[0])};font-size:34px">${e(s.n.split(" ")[0])}</span></div>
 <h1 class="h">${e(s.n)}</h1><p class="sub">Для: ${e(s.for.join(", "))}. Внутри: ${e(s.ex)}.</p>
 ${so?`<div class="pk-note">Этот набор выйдет в одном из следующих обновлений. Здесь показано, что в нём будет.</div>`:""}
 ${seg()}
 <div class="pk-btns"><button class="pk-btn" onclick="PK.soon('Наборы собираются: скачивание появится здесь')">Скачать весь набор</button><button class="pk-btn ghost" onclick="PK.soon('Наборы собираются')">${pc?"Открыть в плагине":"Скачать по одному"}</button></div>
 <div class="sec-t">Палитра</div>
 <div class="pk-pal">${s.pal.map(h=>`<span style="background:${h};color:${parseInt(h.slice(1,3),16)>140?"#111":"#fff"}">${h}</span>`).join("")}</div>
 <div class="sec-t">Пара шрифтов · бесплатно</div>
 <div class="pk-font"><span class="lang">КИРИЛЛИЦА + LATIN</span><span class="a" style="font-family:${fam(s.f[0])};font-weight:${s.f[1]}">Акцент Accent 2026</span><span class="b" style="font-family:${fam(s.fb)}">Основной текст: ${e(s.fb)}. Main text for English captions. Акцент — ${e(s.f[0])}, заметно отличается от основного.</span></div>
 <div class="sec-t">Ещё 20 шрифтов к стилю · кириллица + латиница</div>
 <div class="pk-list">${(loadF20(id),F20[id]).map(f=>`<a class="pk-row pk-fnt" href="https://fonts.google.com/specimen/${f[0].replace(/ /g,"+")}" target="_blank" rel="noopener"><span class="tx"><span class="smp" style="font-family:${fam(f[0])};font-weight:${f[3]}">Монтаж Montage 2026</span><small>${e(f[0])} · ${e(f[1])}${f[2]>=2023?' · <b class="nw">NEW</b>':""}</small></span><span class="arr">↗</span></a>`).join("")}</div>
 <p class="pk-muted" style="margin:-6px 0 0;font-size:12px">Все бесплатные, можно в коммерцию (Google Fonts, лицензия OFL). Нажми, чтобы скачать.</p>
 <div class="sec-t">Что внутри</div>
 <div class="pk-ctabs">${CONTENT.map(x=>`<button class="pk-chip" onclick="PK.ct('${x[0]}')" aria-pressed="${c[0]===x[0]}">${e(x[1])}</button>`).join("")}</div>
 <p class="pk-muted" style="margin:-6px 0 0;font-size:12.5px">${e(c[2])} · формат: <b style="color:var(--text)">${e(fmt)}</b></p>
 <div class="pk-tiles">${items.map(t=>`<button class="pk-tile ${cls}" onclick="PK.soon('Здесь будет превью и скачивание')" style="${c[0]==="bg"?`background:${s.bg};color:${s.fg}`:""}"><span style="font-family:${fam(s.f[0])};color:${c[0]==="mu"?"var(--text)":s.fg}">${c[0]==="mu"?"♪ ":""}${e(t)}</span><span class="fmt">${e(fmt)}</span></button>`).join("")}</div>
 ${!pc&&["ov","an","tr"].includes(c[0])?`<a class="pk-row" href="${H("cheat/"+(c[0]==="ov"?"black":"green"))}"><span class="ic">✎</span><span class="tx"><b>Как вставить в CapCut</b><small>${c[0]==="ov"?"Режим смешивания «Экран»":"Хромакей по зелёному"}</small></span><span class="arr">→</span></a>`:""}`}},

svc(){return {t:"Справочник сервисов",v:`<h1 class="h">Справочник сервисов</h1><p class="sub">У каждого сервиса: что даёт бесплатно, что по подписке и когда его брать.</p>
 ${seg()}
 <div class="pk-chips"><button class="pk-chip" onclick="PK.mode('task')" aria-pressed="${mode==="task"}">Мне нужно…</button><button class="pk-chip" onclick="PK.mode('cat')" aria-pressed="${mode==="cat"}">По разделам</button><button class="pk-chip" onclick="PK.mode('free')" aria-pressed="${mode==="free"}">Только бесплатные</button></div>
 ${mode==="task"?`<div class="pk-list">${TASKS.filter(t=>SVC.some(s=>s.t.includes(t[0])&&plat(s))).map(t=>`<a class="pk-row" href="${H("list/t:"+t[0])}"><span class="tx"><b>${e(t[1])}</b><small>${SVC.filter(s=>s.t.includes(t[0])&&plat(s)).map(s=>s.n).slice(0,4).join(", ")}</small></span><span class="arr">→</span></a>`).join("")}</div>`
 :mode==="cat"?`<div class="pk-grid">${CATS.filter(c=>SVC.some(s=>s.c===c[0]&&plat(s))).map(c=>`<a class="pk-card" style="min-height:0" href="${H("list/c:"+c[0])}"><b>${e(c[1])}</b><small>${SVC.filter(s=>s.c===c[0]&&plat(s)).length} сервисов</small></a>`).join("")}</div>`
 :`<div class="pk-list">${SVC.filter(s=>plat(s)&&/Подписки нет/.test(s.pd)).map(card).join("")}</div>`}
 <div class="pk-note">Черновик: цены и условия сверить на сайтах перед выпуском.</div>`}},

list(p){const [k,v]=p.split(":");const it=k==="t"?TASKS.find(t=>t[0]===v):CATS.find(c=>c[0]===v);if(!it)return null;
 const arr=SVC.filter(s=>(k==="t"?s.t.includes(v):s.c===v)&&plat(s)).sort((a,b)=>(b.pick||0)-(a.pick||0));
 return {t:it[1],v:`<h1 class="h">${e(it[1])}</h1>${seg()}${arr.length?`<div class="pk-list">${arr.map(card).join("")}</div>`:`<div class="pk-empty">С ${dev==="pc"?"компьютера":"телефона"} здесь пока ничего. Переключи устройство.</div>`}`}},

cheats(){const arr=CHEATS.filter(c=>dev==="pc"?c.pc:c.ph);
 return {t:"Шпаргалки",v:`<h1 class="h">Шпаргалки</h1><p class="sub">Коротко, по шагам. Собраны из частых ошибок в домашках.</p>${seg()}
 <div class="pk-list">${arr.map(c=>`<a class="pk-row" href="${H("cheat/"+c.id)}"><span class="ic">✎</span><span class="tx"><b>${e(c.n)}</b><small>${e(c.d)}</small></span>${c.steps?'<span class="arr">→</span>':'<span class="pk-badge o">ПИШЕТСЯ</span>'}</a>`).join("")}</div>`}},

cheat(id){const c=CHEATS.find(x=>x.id===id);if(!c)return null;
 return {t:c.n,v:`<h1 class="h">${e(c.n)}</h1><p class="sub">${e(c.d)}</p>
 ${c.steps?`<div class="pk-box"><ol class="pk-steps">${c.steps.map(s=>`<li>${e(s)}</li>`).join("")}</ol></div><div class="pk-vid" style="max-width:200px"><small>видео</small></div>`:`<div class="pk-empty">Шпаргалка пишется. Формат как у «Оверлей на чёрном фоне»: шаги и короткое видео.</div>`}`}},

checks(){return {t:"Чек-лист",v:`<h1 class="h">Чек-лист перед сдачей</h1><p class="sub">Пройди перед тем, как отправить клиенту. Галочки сохраняются у тебя.</p>
 <div class="pk-box">${CHECKS.map((c,i)=>`<label class="pk-check"><input type="checkbox" ${load("kk_pk_ck"+i)==="1"?"checked":""} onchange="PK.ck(${i},this.checked)"><span>${e(c[0])}<small>${e(c[1])}</small></span></label>`).join("")}</div>
 <button class="pk-btn ghost" onclick="PK.reset()">Сбросить для нового ролика</button>`}},

brief(){return {t:"Бриф клиента",v:`<h1 class="h">Бриф клиента</h1><p class="sub">Отправь клиенту до начала монтажа. Меньше правок и споров о «а я хотела по-другому».</p>
 <div class="pk-box"><ol class="pk-steps">${BRIEF.map(b=>`<li>${e(b)}</li>`).join("")}</ol></div>
 <button class="pk-btn" onclick="PK.copy()">Скопировать бриф</button>`}},

tuts(){const arr=TUTS.filter(t=>devOk(t[1]));
 return {t:"Туториалы",v:`<h1 class="h">Туториалы</h1><p class="sub">Мультяшные, по 1–2 минуты: анимированный интерфейс и шаги на экране.</p>${seg()}
 <div class="pk-tuts">${arr.map(t=>`<div class="pk-tut"><span class="pk-vid"><small>${t[2]}</small></span><b>${e(t[0])}</b></div>`).join("")}</div>
 <p class="pk-note">Туториалы в производстве.</p>`}}
};

/* ---------- публичное ---------- */
window.PK={
 view(path){const [k,...rest]=(path||"").replace(/^\//,"").split("/");const fn=V[k||"home"];const r=fn&&fn(decodeURIComponent(rest.join("/")));
  return r?{t:r.t,v:`<div class="pk">${r.v}</div>`}:null},
 hero(){return `<a class="pk-hero" href="#mat/pk"><span class="ch"></span><span class="pk-new">NEW · ВИДИШЬ ТОЛЬКО ТЫ</span><b>Пак режиссёра монтажа</b><small>Плагины для Премьера, стилевые наборы, справочник сервисов, шпаргалки и чек-листы. Для компьютера и телефона.</small></a>`},
 dev(d){dev=d;store("kk_pk_dev",d);route()},
 client(c){client=c;route()},
 ct(c){ct=c;route()},
 mode(m){mode=m;route()},
 ck(i,v){store("kk_pk_ck"+i,v?"1":undefined)},
 reset(){CHECKS.forEach((_,i)=>store("kk_pk_ck"+i,undefined));route()},
 copy(){const t=BRIEF.map((b,i)=>(i+1)+". "+b).join("\n");(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>soon("Бриф скопирован"),()=>soon("Не получилось скопировать"))},
 soon,
 async key(){const b=document.getElementById("pk-key");b.hidden=false;b.innerHTML='<p class="pk-muted" style="margin:0">Получаю ключ…</p>';
  try{const r=await api({api:"pluginkey"});
   if(!r.ok){b.innerHTML='<p class="pk-muted" style="margin:0">'+(r.error==="pack_soon"?"Плагин скоро откроется ученицам.":"Не получилось: "+e(r.error||""))+'</p>';return}
   b.innerHTML='<h3>Твой ключ для плагина</h3><p class="pk-muted" style="margin:0">Скопируй и вставь в плагин при первом запуске. Ключ личный — не передавай его.</p><code style="word-break:break-all;font:500 11px var(--f-mono);background:var(--panel2);padding:10px;border-radius:8px;user-select:all">'+e(r.key)+'</code><button class="pk-btn" onclick="PK.copyKey()">Скопировать ключ</button>';PK._k=r.key}
  catch(x){b.innerHTML='<p class="pk-muted" style="margin:0">Нет связи с сервером. Попробуй ещё раз.</p>'}},
 copyKey(){(navigator.clipboard?navigator.clipboard.writeText(PK._k):Promise.reject()).then(()=>soon("Ключ скопирован"),()=>soon("Выдели ключ и скопируй вручную"))}
};
})();
