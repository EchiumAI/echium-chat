import React from 'react';
import { BaseProps } from '../@types/common';
import { twMerge } from 'tailwind-merge';

type Props = BaseProps & {
  disabled?: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
};

const ButtonIcon: React.FC<Props> = (props) => {
  return (
    <button
      className={twMerge(
        // Match the docs editor's icon-button language: a soft background wash
        // on hover (rounded-md) instead of a shadow/brightness shift. Base text
        // color is intentionally left inherited so icons stay legible on both
        // the light content areas and the dark sidebar.
        'flex items-center justify-center rounded-md p-2 text-xl transition-colors',
        'dark:text-aws-font-color-dark',
        props.disabled
          ? 'opacity-30'
          : 'hover:bg-black/5 dark:hover:bg-white/10',
        props.className
      )}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        props.onClick(e);
      }}
      disabled={props.disabled}>
      {props.children}
    </button>
  );
};

export default ButtonIcon;
