/* Port dari Brilliant-Chess (MIT, © 2025 Delo) — jangan sunting massal tanpa cek README. */
function Clock(props) {
  const { white, colorMoving } = props;
  const time = props.children;
  const moving = white ? colorMoving === "w" : colorMoving === "b";
  return <div className={`flex text-nowrap justify-end group-data-[panel-sejajar=true]/papan:pr-3 pr-[6px] group-data-[panel-sejajar=true]/papan:text-2xl text-base font-bold items-center group-data-[panel-sejajar=true]/papan:h-11 h-7 group-data-[panel-sejajar=true]/papan:min-w-36 group-data-[panel-sejajar=true]/papan:max-w-36 min-w-16 max-w-16 rounded-borderRoundness ${moving ? "" : "opacity-50"} ${white ? "bg-backgroundWhiteClock" : "bg-backgroundBlackClock"} ${white ? "text-backgroundBlackClock" : "text-backgroundWhiteClock"}`}>
            {time}
        </div>;
}
export {
  Clock as default
};
