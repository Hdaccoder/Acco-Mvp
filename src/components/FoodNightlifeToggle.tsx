"use client";
import { usePathname, useRouter } from "next/navigation";
export default function FoodNightlifeToggle() {
  const pathname = usePathname();
  const router = useRouter();
  const isFood = pathname.startsWith('/food');

  const handleToggle = () => {
    if (isFood) {
      router.push('/');
    } else {
      router.push('/food');
    }
  };

  return (
    <button
      onClick={handleToggle}
      className="px-3 py-1 rounded-lg border border-yellow-400 text-yellow-300 hover:bg-yellow-400/90 hover:text-black transition"
      aria-pressed={isFood}
      style={{ minWidth: 90 }}
    >
      {isFood ? 'Nightlife' : 'Food'}
    </button>
  );
}
