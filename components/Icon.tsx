import React from "react";

export type IconName =
  | "account_circle"
  | "arrow_forward"
  | "bolt"
  | "check_circle"
  | "lock"
  | "send"
  | "key"
  | "forum"
  | "chat_bubble"
  | "verified"
  | "shield"
  | "contacts"
  | "hub"
  | "add"
  | "search"
  | "tag"
  | "download"
  | "more_vert"
  | "star"
  | "star_outline"
  | "close"
  | "person"
  | "edit"
  | "sync";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName | string;
  size?: number | string;
  filled?: boolean;
  className?: string;
}

export default function Icon({
  name,
  size = 20,
  filled = false,
  className = "",
  style,
  ...props
}: IconProps) {
  const numSize = typeof size === "number" ? size : parseInt(size as string, 10) || 20;

  // Render SVG based on icon name
  const renderPath = () => {
    switch (name) {
      case "account_circle":
        return (
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"
            clipRule="evenodd"
          />
        );

      case "arrow_forward":
        return (
          <path
            d="M5 12h14M12 5l7 7-7 7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        );

      case "bolt":
        return (
          <path
            d="M13 2L4 13.5h7L9.5 22 20 10.5h-7L13 2z"
            fill="currentColor"
          />
        );

      case "check_circle":
        return (
          <>
            <circle
              cx="12"
              cy="12"
              r="9.5"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M8 12.2l2.8 2.8L16.2 9"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </>
        );

      case "lock":
        return (
          <>
            <rect
              x="5"
              y="10"
              width="14"
              height="11"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M8 10V7a4 4 0 018 0v3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="12" cy="15.5" r="1.5" fill="currentColor" />
          </>
        );

      case "send":
        return (
          <path
            d="M2.5 12.2l18.5-8.2-5 17-5.5-5.5-2.5 3.5V14.5l8.5-8.5-11 5.2z"
            fill="currentColor"
          />
        );

      case "key":
        return (
          <>
            <circle
              cx="7.5"
              cy="15.5"
              r="4.5"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M10.8 12.2L19.5 3.5M16.5 6.5l2 2M14.5 8.5l1.5 1.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </>
        );

      case "forum":
      case "chat":
        return (
          <>
            <path
              d="M18 14H6l-3 3V5a2 2 0 012-2h13a2 2 0 012 2v7a2 2 0 01-2 2z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M18 8h3a2 2 0 012 2v9l-3-3h-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </>
        );

      case "chat_bubble":
        return (
          <path
            d="M20 2H4a2 2 0 00-2 2v13a2 2 0 002 2h13l4 4V4a2 2 0 00-2-2z"
            fill="currentColor"
          />
        );

      case "verified":
      case "shield":
        return (
          <>
            <path
              d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M9 12l2 2 4-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </>
        );

      case "contacts":
        return (
          <>
            <path
              d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <circle
              cx="9"
              cy="7"
              r="4"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </>
        );

      case "hub":
        return (
          <>
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
            <circle cx="19" cy="6" r="2" fill="currentColor" />
            <circle cx="5" cy="6" r="2" fill="currentColor" />
            <circle cx="5" cy="18" r="2" fill="currentColor" />
            <circle cx="19" cy="18" r="2" fill="currentColor" />
            <path
              d="M10 10.5L6.5 7.5M14 10.5l3.5-3M10 13.5L6.5 16.5M14 13.5l3.5 3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        );

      case "add":
        return (
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        );

      case "search":
        return (
          <>
            <circle
              cx="11"
              cy="11"
              r="7"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M16.5 16.5L21 21"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </>
        );

      case "tag":
        return (
          <path
            d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 21"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        );

      case "download":
        return (
          <>
            <path
              d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M7 10l5 5 5-5M12 15V3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </>
        );

      case "more_vert":
        return (
          <>
            <circle cx="12" cy="5" r="1.8" fill="currentColor" />
            <circle cx="12" cy="12" r="1.8" fill="currentColor" />
            <circle cx="12" cy="19" r="1.8" fill="currentColor" />
          </>
        );

      case "star":
        if (filled) {
          return (
            <polygon
              points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
              fill="currentColor"
            />
          );
        }
        return (
          <polygon
            points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        );

      case "star_outline":
        return (
          <polygon
            points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        );

      case "close":
        return (
          <path
            d="M18 6L6 18M6 6l12 12"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        );

      case "person":
        return (
          <>
            <path
              d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <circle
              cx="12"
              cy="7"
              r="4"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
          </>
        );

      case "sync":
        return (
          <>
            <path
              d="M21.5 2v6h-6M2.5 22v-6h6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M20.49 9A9 9 0 005.64 5.64L2.5 8.5m19 7l-3.14 2.86A9 9 0 013.51 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </>
        );

      case "edit":
        return (
          <path
            d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
            fill="currentColor"
          />
        );

      default:
        // Fallback simple circle
        return <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />;
    }
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={numSize}
      height={numSize}
      className={`inline-block shrink-0 select-none align-middle ${className}`}
      style={style}
      aria-hidden="true"
      {...props}
    >
      {renderPath()}
    </svg>
  );
}
