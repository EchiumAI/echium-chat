import React, { ReactNode, useState } from 'react';
import { PiCaretDown } from 'react-icons/pi';
import { twMerge } from 'tailwind-merge';

type Props = {
  className?: string;
  label: string;
  children: ReactNode;
  isDefaultShow?: boolean;
};

const ExpandableDrawerGroup: React.FC<Props> = ({
  isDefaultShow = true,
  ...props
}) => {
  const [isShow, setIsShow] = useState(isDefaultShow);

  return (
    <div className={twMerge(props.className)}>
      <div
        className="group flex w-full cursor-pointer items-center gap-1.5 px-2 py-1.5 text-white/40 transition hover:text-white/80"
        onClick={() => {
          setIsShow(!isShow);
        }}>
        <PiCaretDown
          className={`text-[10px] transition-transform ${
            isShow ? '' : '-rotate-90'
          }`}
        />
        <div className="text-[11px] font-medium uppercase tracking-[0.08em]">
          {props.label}
        </div>
      </div>
      <div className="">
        <div
          className={`origin-top transition-all ${
            isShow ? 'visible' : 'h-0 scale-y-0'
          }`}>
          {props.children}
        </div>
      </div>
    </div>
  );
};

export default ExpandableDrawerGroup;
