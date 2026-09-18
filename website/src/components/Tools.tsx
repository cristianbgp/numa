import ArtworkGenerator from "./artwork-generator";
import GradientAnimator from "./gradient-animator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

const tools = [
  {
    id: "artwork-generator",
    title: "Artwork",
    description: "Create minimalist cover art for your sound journals",
    component: <ArtworkGenerator />,
  },
  {
    id: "gradient-animator",
    title: "Gradient Animator",
    description: "Create animated gradient backgrounds for your website",
    component: <GradientAnimator />,
  },
  {
    id: "how-it-sounds",
    title: "How It Sounds",
    description: "Turn a thought into a public sound journal",
    href: "/how-it-sounds",
  },
];

export default function ToolsComponent({ tab }: { tab: string }) {
  return (
    <div>
      <Tabs defaultValue={tab}>
        <TabsList>
          {tools.map((tool) =>
            "href" in tool ? (
              <TabsTrigger
                key={tool.id}
                value={tool.id}
                className="cursor-pointer"
                asChild
              >
                <a href={tool.href}>{tool.title}</a>
              </TabsTrigger>
            ) : (
              <TabsTrigger
                key={tool.id}
                value={tool.id}
                className="cursor-pointer"
                onClick={() => {
                  window.history.pushState({}, "", `/tools?tab=${tool.id}`);
                }}
              >
                {tool.title}
              </TabsTrigger>
            ),
          )}
        </TabsList>
        {tools.map((tool) =>
          "component" in tool ? (
            <TabsContent key={tool.id} value={tool.id}>
              {tool.component}
            </TabsContent>
          ) : null,
        )}
      </Tabs>
    </div>
  );
}
