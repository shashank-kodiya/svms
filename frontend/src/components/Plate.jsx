import { formatReg } from '../utils/format.js';

// Indian-style number plate.
export default function Plate({ reg }) {
  return (
    <span className="plate"><i>IND</i><span>{formatReg(reg)}</span></span>
  );
}
