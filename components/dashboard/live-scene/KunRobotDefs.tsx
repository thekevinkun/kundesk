// Gradients for the KUN robot — gold for a running KUN, steel for an inactive one
// Ids come from the palette helper so the references can never point at a missing gradient

import { KUN_GRADIENTS } from "@/helpers/kun-robot-palette";

const KunRobotDefs = () => (
  <defs>
    {/* Gold shell: light top-left, deep amber bottom-right */}
    <linearGradient id={KUN_GRADIENTS.goldBody} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#FFEBB0" />
      <stop offset="0.5" stopColor="#F7BE45" />
      <stop offset="1" stopColor="#D98E1F" />
    </linearGradient>
    {/* Darker gold for ear cups, neck and arms */}
    <linearGradient id={KUN_GRADIENTS.goldDark} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#F0B13A" />
      <stop offset="1" stopColor="#B8741A" />
    </linearGradient>
    {/* Dark glossy visor */}
    <linearGradient id={KUN_GRADIENTS.visor} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#2A3447" />
      <stop offset="1" stopColor="#0B0F17" />
    </linearGradient>
    {/* Steel versions used when KUN is off */}
    <linearGradient id={KUN_GRADIENTS.steelBody} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#E3E7EE" />
      <stop offset="0.5" stopColor="#B6BDCB" />
      <stop offset="1" stopColor="#8E97A8" />
    </linearGradient>
    <linearGradient id={KUN_GRADIENTS.steelDark} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#A5AEBE" />
      <stop offset="1" stopColor="#6E7787" />
    </linearGradient>
    <linearGradient id={KUN_GRADIENTS.visorOff} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#4A5263" />
      <stop offset="1" stopColor="#2B313D" />
    </linearGradient>
  </defs>
);

export default KunRobotDefs;
