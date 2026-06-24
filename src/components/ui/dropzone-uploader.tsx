import { useDropzone } from "react-dropzone";
import { Upload, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropzoneUploaderProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  label?: string;
  subLabel?: string;
}

export function DropzoneUploader({ 
  onFileSelect, 
  selectedFile, 
  label = "파일을 드래그하거나 클릭하여 업로드", 
  subLabel = "PDF, JPG, PNG (Max 5MB)" 
}: DropzoneUploaderProps) {
  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'application/pdf': [] },
    maxSize: 5242880,
    multiple: false
  });

  return (
    <div {...getRootProps()} className={cn("border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 w-full", isDragActive ? "border-primary bg-primary/10 scale-[1.02]" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50")}>
      <input {...getInputProps()} />
      {selectedFile ? (
        <div className="flex flex-col items-center text-green-600 animate-in zoom-in duration-300">
          <CheckCircle2 className="w-8 h-8 mb-2" />
          <p className="text-sm font-bold text-foreground truncate max-w-[250px]">{selectedFile.name}</p>
          <p className="text-[10px] text-muted-foreground mt-1">클릭하여 다른 파일로 교체할 수 있습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center text-muted-foreground">
          <Upload className={cn("w-8 h-8 mb-2 transition-colors", isDragActive ? "text-primary" : "text-muted-foreground/50")} />
          <p className="text-sm font-bold text-foreground">{isDragActive ? "여기에 파일을 놓으세요" : label}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{subLabel}</p>
        </div>
      )}
    </div>
  );
}
