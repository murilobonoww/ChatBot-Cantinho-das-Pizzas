import { useId } from "react";
import '@/Style/CheckboxSplash.css';

export default function CheckboxSplash({ checked, onChange }) {
  const id = useId();

  return (
    <div className="checkbox-wrapper-12">
      <div className="cbx">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={onChange}
        />
        <label htmlFor={id}></label>
        <svg fill="none" viewBox="0 0 15 14" height="14" width="15">
          <path d="M2 8.36364L6.23077 12L13 2"></path>
        </svg>
      </div>

      <svg xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="goo-12">
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="4"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  
                      0 1 0 0 0  
                      0 0 1 0 0  
                      0 0 0 22 -7"
              result="goo-12"
            />
            <feBlend in="SourceGraphic" in2="goo-12" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}