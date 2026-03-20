import Image from "next/image";

type LogoVariant = "horizontal" | "stacked" | "mark";
type LogoTheme = "light" | "dark";

type QuizlyLogoProps = {
  variant?: LogoVariant;
  theme?: LogoTheme;
  className?: string;
  priority?: boolean;
};

const logoSources: Record<LogoVariant, Record<LogoTheme, string>> = {
  horizontal: {
    light: "/brand/quizly-logo-horizontal-light.svg",
    dark: "/brand/quizly-logo-horizontal-dark.svg",
  },
  stacked: {
    light: "/brand/quizly-logo-stacked-light.svg",
    dark: "/brand/quizly-logo-stacked-dark.svg",
  },
  mark: {
    light: "/brand/quizly-mark-light.svg",
    dark: "/brand/quizly-mark-dark.svg",
  },
};

const dimensions: Record<LogoVariant, { width: number; height: number }> = {
  horizontal: { width: 980, height: 320 },
  stacked: { width: 640, height: 640 },
  mark: { width: 512, height: 512 },
};

export default function QuizlyLogo({
  variant = "horizontal",
  theme = "light",
  className,
  priority = false,
}: QuizlyLogoProps) {
  const src = logoSources[variant][theme];
  const { width, height } = dimensions[variant];

  return (
    <Image
      src={src}
      alt="Quizly ロゴ"
      width={width}
      height={height}
      className={className}
      priority={priority}
      fetchPriority={priority ? "high" : undefined}
    />
  );
}
