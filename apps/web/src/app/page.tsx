import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-8">
      <div className="max-w-2xl text-center">
        <h2 className="text-4xl font-bold mb-4">
          Your Intelligent Email Assistant
        </h2>
        <p className="text-lg text-gray-600 mb-8">
          Powered by Mastra AI. Manage your inbox efficiently with AI-powered
          email classification, smart replies, and automated workflows.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/sign-in"
            className="px-6 py-3 text-sm font-medium text-white bg-black rounded-md hover:bg-gray-800"
          >
            Get Started
          </a>
        </div>
      </div>
    </div>
  );
}
