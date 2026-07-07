import { AuthButton } from "@/components/AuthButton";
import { Board } from "@/components/Board";

export default function Home() {
  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900">工作台</h1>
          <p className="text-sm text-gray-500 mt-0.5">需求进展一览</p>
        </div>
        <AuthButton />
      </header>
      <Board />
    </main>
  );
}
