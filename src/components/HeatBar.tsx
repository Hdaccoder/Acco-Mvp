export default function HeatBar({ score }: { score: number }) {
const clamped = Math.max(0, Math.min(100, Math.round(score)));
return (
<div className="w-full h-2 bg-neutral-800 rounded">
<div
className="h-2 rounded bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600"
style={{ width: `${clamped}%` }}
/>
</div>
);
}