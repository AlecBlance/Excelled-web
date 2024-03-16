import InputFile from "@/components/InputFile.components";
import { Toaster } from "@/components/ui/sonner";

const Home = () => {
  return (
    <>
      <Toaster
        toastOptions={{
          style: {
            background: "#1A1A1A",
          },
          className: "class",
        }}
      />
      <div className="flex flex-col justify-center items-center h-screen p-5">
        <div className="font-extrabold text-4xl mb-10 md:text-5xl">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-excelled-gradient-from to-excelled-gradient-to">
            EXCELLED
          </span>
        </div>
        <div className="bg-excelled-bg space-y-20 flex-col p-7 md:px-32 flex justify-center items-center w-full h-4/6 rounded-lg md:w-auto md:p-10">
          <p className="text-center">UPLOAD YOUR LOCKED EXCEL FILE</p>
          <InputFile />
        </div>
        <div className="mt-10">
          <p className="text-excelled-text text-sm">BY ALEC BLANCE</p>
        </div>
      </div>
    </>
  );
};

export default Home;
