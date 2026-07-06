import { SVGProps } from 'react';

// Import raw SVGs from phosphoricon/icons directory
import terminalWindowSvg from '../../phosphoricon/icons/terminal-window.svg?raw';
import githubLogoSvg from '../../phosphoricon/icons/github-logo.svg?raw';
import twitterLogoSvg from '../../phosphoricon/icons/twitter-logo.svg?raw';
import envelopeSimpleSvg from '../../phosphoricon/icons/envelope-simple.svg?raw';
import calendarBlankSvg from '../../phosphoricon/icons/calendar-blank.svg?raw';
import clockSvg from '../../phosphoricon/icons/clock.svg?raw';
import arrowRightSvg from '../../phosphoricon/icons/arrow-right.svg?raw';
import arrowLeftSvg from '../../phosphoricon/icons/arrow-left.svg?raw';
import tagSvg from '../../phosphoricon/icons/tag.svg?raw';
import bugSvg from '../../phosphoricon/icons/bug.svg?raw';
import magnifyingGlassSvg from '../../phosphoricon/icons/magnifying-glass.svg?raw';
import xSvg from '../../phosphoricon/icons/x.svg?raw';
import slidersHorizontalSvg from '../../phosphoricon/icons/sliders-horizontal.svg?raw';
import wrenchSvg from '../../phosphoricon/icons/wrench.svg?raw';
import pencilSvg from '../../phosphoricon/icons/pencil.svg?raw';
import trashSvg from '../../phosphoricon/icons/trash.svg?raw';
import plusSvg from '../../phosphoricon/icons/plus.svg?raw';
import signOutSvg from '../../phosphoricon/icons/sign-out.svg?raw';
import checkSquareSvg from '../../phosphoricon/icons/check-square.svg?raw';
import squareSvg from '../../phosphoricon/icons/square.svg?raw';
import squaresFourSvg from '../../phosphoricon/icons/squares-four.svg?raw';
import chatTeardropSvg from '../../phosphoricon/icons/chat-teardrop.svg?raw';
import fileTextSvg from '../../phosphoricon/icons/file-text.svg?raw';
import gearSvg from '../../phosphoricon/icons/gear.svg?raw';
import arrowUpSvg from '../../phosphoricon/icons/arrow-up.svg?raw';
import robotSvg from '../../phosphoricon/icons/robot.svg?raw';
import shoppingCartSvg from '../../phosphoricon/icons/shopping-cart.svg?raw';
import checkSvg from '../../phosphoricon/icons/check.svg?raw';
import copySvg from '../../phosphoricon/icons/copy.svg?raw';
import spinnerGapSvg from '../../phosphoricon/icons/spinner-gap.svg?raw';
import checkCircleSvg from '../../phosphoricon/icons/check-circle.svg?raw';
import xCircleSvg from '../../phosphoricon/icons/x-circle.svg?raw';
import caretRightSvg from '../../phosphoricon/icons/caret-right.svg?raw';
import caretDownSvg from '../../phosphoricon/icons/caret-down.svg?raw';
import folderSvg from '../../phosphoricon/icons/folder.svg?raw';
import folderOpenSvg from '../../phosphoricon/icons/folder-open.svg?raw';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

function getSvgInner(rawSvg: string): string {
  const match = rawSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  return match ? match[1] : '';
}

function createIcon(svgContent: string) {
  return ({ size, ...props }: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size || "1em"}
      height={size || "1em"}
      viewBox="0 0 256 256"
      fill="currentColor"
      dangerouslySetInnerHTML={{ __html: getSvgInner(svgContent) }}
      {...props}
    />
  );
}

export const TerminalWindowIcon = createIcon(terminalWindowSvg);
export const GithubLogoIcon = createIcon(githubLogoSvg);
export const TwitterLogoIcon = createIcon(twitterLogoSvg);
export const EnvelopeSimpleIcon = createIcon(envelopeSimpleSvg);
export const CalendarBlankIcon = createIcon(calendarBlankSvg);
export const ClockIcon = createIcon(clockSvg);
export const ArrowRightIcon = createIcon(arrowRightSvg);
export const ArrowLeftIcon = createIcon(arrowLeftSvg);
export const TagIcon = createIcon(tagSvg);
export const BugIcon = createIcon(bugSvg);
export const SearchIcon = createIcon(magnifyingGlassSvg);
export const XIcon = createIcon(xSvg);
export const SlidersHorizontalIcon = createIcon(slidersHorizontalSvg);
export const WrenchIcon = createIcon(wrenchSvg);
export const PencilIcon = createIcon(pencilSvg);
export const TrashIcon = createIcon(trashSvg);
export const PlusIcon = createIcon(plusSvg);
export const LogOutIcon = createIcon(signOutSvg);
export const CheckSquareIcon = createIcon(checkSquareSvg);
export const SquareIcon = createIcon(squareSvg);
export const LayoutDashboardIcon = createIcon(squaresFourSvg);
export const MessageSquareIcon = createIcon(chatTeardropSvg);
export const FileTextIcon = createIcon(fileTextSvg);
export const SettingsIcon = createIcon(gearSvg);
export const ArrowUpIcon = createIcon(arrowUpSvg);
export const BotIcon = createIcon(robotSvg);
export const ShoppingCartIcon = createIcon(shoppingCartSvg);
export const CheckIcon = createIcon(checkSvg);
export const CopyIcon = createIcon(copySvg);
export const LoaderIcon = createIcon(spinnerGapSvg);
export const CheckCircleIcon = createIcon(checkCircleSvg);
export const XCircleIcon = createIcon(xCircleSvg);
export const CaretRightIcon = createIcon(caretRightSvg);
export const CaretDownIcon = createIcon(caretDownSvg);
export const FolderIcon = createIcon(folderSvg);
export const FolderOpenIcon = createIcon(folderOpenSvg);
