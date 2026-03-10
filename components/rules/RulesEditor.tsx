"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import Youtube from "@tiptap/extension-youtube";
import { 
  Bold, Italic, Underline as UnderlineIcon, 
  Heading1, Heading2, Heading3, 
  Highlighter, Strikethrough, Quote, 
  Code, AlignLeft, AlignCenter, 
  AlignRight, AlignJustify, List, 
  ListOrdered, Link2, 
  Image as ImageIcon, Youtube as YoutubeIcon,
  Save, Loader2, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface RulesEditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  isSaving: boolean;
}

const MenuButton = ({ 
  onClick, 
  active = false, 
  children, 
  title 
}: { 
  onClick: () => void, 
  active?: boolean, 
  children: React.ReactNode,
  title: string
}) => (
  <button
    onClick={(e) => { e.preventDefault(); onClick(); }}
    title={title}
    className={`p-2 rounded-lg transition-all border ${
      active 
        ? "bg-slate-100 border-slate-200 text-blue-600 shadow-sm" 
        : "bg-transparent border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900"
    }`}
  >
    {children}
  </button>
);

export function RulesEditor({ initialContent, onSave, isSaving }: RulesEditorProps) {
  const [previewHtml, setPreviewHtml] = useState(initialContent);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: "Write something..." }),
      Youtube.configure({ width: 480, height: 270 }),
    ],
    immediatelyRender: false,
    content: initialContent,
    onUpdate: ({ editor }) => {
      setPreviewHtml(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-slate max-w-none focus:outline-none min-h-[450px] p-6 text-slate-700",
      },
    },
  });

  // Sync content if it changes externally
  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent);
    }
  }, [initialContent, editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
      {/* Editor Side */}
      <div className="flex-1 bg-white rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] flex flex-col">
        {/* Toolbar - Matching User Image but in Light Mode */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-wrap items-center gap-1">
          <MenuButton 
            title="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
          >
            <Bold className="h-4 w-4" />
          </MenuButton>
          <MenuButton 
            title="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
          >
            <Italic className="h-4 w-4" />
          </MenuButton>
          <MenuButton 
            title="Underline"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
          >
            <UnderlineIcon className="h-4 w-4" />
          </MenuButton>
          
          <div className="w-[1px] h-6 bg-slate-100 mx-2" />

          <MenuButton 
            title="H1"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive("heading", { level: 1 })}
          >
            <Heading1 className="h-4 w-4" />
          </MenuButton>
          <MenuButton 
            title="H2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
          >
            <Heading2 className="h-4 w-4" />
          </MenuButton>
          <MenuButton 
            title="H3"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
          >
            <Heading3 className="h-4 w-4" />
          </MenuButton>

          <MenuButton 
            title="Highlight"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            active={editor.isActive("highlight")}
          >
            <Highlighter className="h-4 w-4" />
          </MenuButton>

          <MenuButton 
            title="Strikethrough"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
          >
            <Strikethrough className="h-4 w-4" />
          </MenuButton>

          <MenuButton 
            title="Quote"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
          >
            <Quote className="h-4 w-4" />
          </MenuButton>

          <div className="w-[1px] h-6 bg-slate-100 mx-2" />

          <MenuButton 
            title="Align Left"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            active={editor.isActive({ textAlign: "left" })}
          >
            <AlignLeft className="h-4 w-4" />
          </MenuButton>
          <MenuButton 
            title="Align Center"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            active={editor.isActive({ textAlign: "center" })}
          >
            <AlignCenter className="h-4 w-4" />
          </MenuButton>
          <MenuButton 
            title="Align Right"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            active={editor.isActive({ textAlign: "right" })}
          >
            <AlignRight className="h-4 w-4" />
          </MenuButton>
          <MenuButton 
            title="Align Justify"
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            active={editor.isActive({ textAlign: "justify" })}
          >
            <AlignJustify className="h-4 w-4" />
          </MenuButton>

          <div className="w-[1px] h-6 bg-slate-100 mx-2" />

          <MenuButton 
            title="Bullet List"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
          >
            <List className="h-4 w-4" />
          </MenuButton>
          <MenuButton 
            title="Ordered List"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
          >
            <ListOrdered className="h-4 w-4" />
          </MenuButton>

          <div className="w-[1px] h-6 bg-slate-100 mx-2" />

          <MenuButton 
            title="Code Block"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive("codeBlock")}
          >
            <Code className="h-4 w-4" />
          </MenuButton>
          <MenuButton 
            title="Link"
            onClick={() => {
              const url = window.prompt("Enter URL");
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }}
            active={editor.isActive("link")}
          >
            <Link2 className="h-4 w-4" />
          </MenuButton>
          <MenuButton title="Image" onClick={() => {}}>
            <ImageIcon className="h-4 w-4" />
          </MenuButton>
          <MenuButton title="Youtube" onClick={() => {}}>
            <YoutubeIcon className="h-4 w-4" />
          </MenuButton>

          <div className="ml-auto flex gap-2">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => editor.commands.clearContent()}
              className="h-10 rounded-xl font-bold px-3 text-slate-400 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button 
              size="sm" 
              onClick={() => onSave(editor.getHTML())}
              disabled={isSaving}
              className="h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest text-[10px] px-6 transition-all shadow-lg active:scale-95 flex gap-2"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Publish
            </Button>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 overflow-y-auto bg-white relative group min-h-[500px]">
          <EditorContent editor={editor} />
          
          <div className="absolute bottom-6 left-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 pointer-events-none group-focus-within:opacity-0 transition-opacity">
            Authority Rules Designer
          </div>
        </div>
      </div>

      {/* Live Preview Side */}
      <div className="hidden xl:flex flex-col w-[450px] gap-4 shrink-0">
        <div className="text-slate-400 font-black uppercase tracking-widest text-[10px] flex items-center gap-2 px-2">
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          Live Participant View
        </div>
        <div className="flex-1 bg-[#fcfcfc] rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-8 overflow-y-auto">
                <div 
                    className={`prose prose-slate max-w-none 
                    prose-headings:text-slate-900 prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight
                    prose-p:text-slate-600 prose-p:leading-relaxed
                    prose-strong:text-slate-900 prose-strong:font-black`}
                    dangerouslySetInnerHTML={{ __html: previewHtml }} 
                />
            </div>
        </div>
      </div>

      <style jsx global>{`
        .prose pre {
           background: #f8fafc;
           border-radius: 12px;
           padding: 1rem;
           border: 1px solid #e2e8f0;
           color: #1e293b;
        }
        .prose blockquote {
            border-left: 4px solid #2563eb;
            background: #f0f9ff;
            padding: 1.5rem;
            border-radius: 0 16px 16px 0;
            color: #1e3a8a;
            font-style: italic;
        }
        .prose mark {
            background-color: #fef08a;
            color: #1a1a1a;
            padding: 2px 6px;
            border-radius: 6px;
        }
      `}</style>
    </div>
  );
}
