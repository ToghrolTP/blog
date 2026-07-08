import { SVGProps } from 'react';

import terminalWindowSvg from '../assets/icons/terminal-window.svg?raw';
import githubLogoSvg from '../assets/icons/github-logo.svg?raw';

import userSvg from '../assets/icons/user.svg?raw';
import eyeSvg from '../assets/icons/eye.svg?raw';
import eyeSlashSvg from '../assets/icons/eye-slash.svg?raw';
import floppyDiskSvg from '../assets/icons/floppy-disk.svg?raw';
import packageSvg from '../assets/icons/package.svg?raw';
import downloadSvg from '../assets/icons/download.svg?raw';
import sparkleSvg from '../assets/icons/sparkle.svg?raw';
import warningSvg from '../assets/icons/warning.svg?raw';
import bookmarkSvg from '../assets/icons/bookmark.svg?raw';
import twitterLogoSvg from '../assets/icons/twitter-logo.svg?raw';
import envelopeSimpleSvg from '../assets/icons/envelope-simple.svg?raw';
import calendarBlankSvg from '../assets/icons/calendar-blank.svg?raw';
import clockSvg from '../assets/icons/clock.svg?raw';
import arrowRightSvg from '../assets/icons/arrow-right.svg?raw';
import arrowLeftSvg from '../assets/icons/arrow-left.svg?raw';
import tagSvg from '../assets/icons/tag.svg?raw';
import bugSvg from '../assets/icons/bug.svg?raw';
import magnifyingGlassSvg from '../assets/icons/magnifying-glass.svg?raw';
import xSvg from '../assets/icons/x.svg?raw';
import slidersHorizontalSvg from '../assets/icons/sliders-horizontal.svg?raw';
import wrenchSvg from '../assets/icons/wrench.svg?raw';
import pencilSvg from '../assets/icons/pencil.svg?raw';
import trashSvg from '../assets/icons/trash.svg?raw';
import plusSvg from '../assets/icons/plus.svg?raw';
import signOutSvg from '../assets/icons/sign-out.svg?raw';
import checkSquareSvg from '../assets/icons/check-square.svg?raw';
import squareSvg from '../assets/icons/square.svg?raw';
import squaresFourSvg from '../assets/icons/squares-four.svg?raw';
import chatTeardropSvg from '../assets/icons/chat-teardrop.svg?raw';
import fileTextSvg from '../assets/icons/file-text.svg?raw';
import gearSvg from '../assets/icons/gear.svg?raw';
import arrowUpSvg from '../assets/icons/arrow-up.svg?raw';
import robotSvg from '../assets/icons/robot.svg?raw';
import shoppingCartSvg from '../assets/icons/shopping-cart.svg?raw';
import checkSvg from '../assets/icons/check.svg?raw';
import copySvg from '../assets/icons/copy.svg?raw';
import spinnerGapSvg from '../assets/icons/spinner-gap.svg?raw';
import checkCircleSvg from '../assets/icons/check-circle.svg?raw';
import xCircleSvg from '../assets/icons/x-circle.svg?raw';
import caretRightSvg from '../assets/icons/caret-right.svg?raw';
import caretDownSvg from '../assets/icons/caret-down.svg?raw';
import folderSvg from '../assets/icons/folder.svg?raw';
import folderOpenSvg from '../assets/icons/folder-open.svg?raw';

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

export const UserIcon = createIcon(userSvg);
export const EyeIcon = createIcon(eyeSvg);
export const EyeSlashIcon = createIcon(eyeSlashSvg);
export const FloppyDiskIcon = createIcon(floppyDiskSvg);
export const PackageIcon = createIcon(packageSvg);
export const DownloadIcon = createIcon(downloadSvg);
export const SparkleIcon = createIcon(sparkleSvg);
export const WarningIcon = createIcon(warningSvg);
export const BookmarkIcon = createIcon(bookmarkSvg);
