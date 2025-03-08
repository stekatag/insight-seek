import { SVGAttributes } from "react";

type ApplicationLogoProps = SVGAttributes<SVGElement> & {
  fill?: string;
  className?: string;
};

export default function ApplicationLogo({
  fill = "currentColor",
  className,
}: ApplicationLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fillRule="evenodd"
      strokeLinejoin="round"
      strokeMiterlimit="2"
      clipRule="evenodd"
      viewBox="0 0 32 32"
      id="lamp"
      className={className}
    >
      <path
        d="M12.003 20H12a3.001 3.001 0 0 0-.711 5.915l1.49 3.725A2.163 2.163 0 0 0 14.787 31h2.426c.884 0 1.679-.538 2.008-1.36l1.49-3.725A3.001 3.001 0 0 0 20 20h-.003l-.005-2.067A7.999 7.999 0 0 0 24 11c0-4.415-3.585-8-8-8s-8 3.585-8 8a7.999 7.999 0 0 0 4.008 6.933L12.003 20Zm6.52 6h-5.046l1.159 2.898a.164.164 0 0 0 .151.102h2.426a.164.164 0 0 0 .151-.102L18.523 26Zm1.49-2A1 1 0 0 0 20 22h-8a1 1 0 0 0-.013 2h8.026Zm-2.016-4-.007-2.667a1 1 0 0 1 .572-.907A6.005 6.005 0 0 0 22 11c0-3.311-2.689-6-6-6s-6 2.689-6 6a6.005 6.005 0 0 0 3.438 5.426 1 1 0 0 1 .572.907L14.003 20H15v-4.586l-1.707-1.707a1 1 0 0 1 1.414-1.414L16 13.586l1.293-1.293a1 1 0 0 1 1.414 1.414L17 15.414V20h.997Zm7.296-6.293 2 2a1 1 0 0 0 1.414-1.414l-2-2a1 1 0 0 0-1.414 1.414Zm-20-1.414-2 2a1 1 0 0 0 1.414 1.414l2-2a1 1 0 0 0-1.414-1.414ZM6 7H4a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2Zm20 2h2a1 1 0 0 0 0-2h-2a1 1 0 0 0 0 2ZM9.707 3.293l-2-2a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414-1.414Zm14 1.414 2-2a1 1 0 0 0-1.414-1.414l-2 2a1 1 0 0 0 1.414 1.414Z"
        fill={fill}
      ></path>
    </svg>
  );
}
