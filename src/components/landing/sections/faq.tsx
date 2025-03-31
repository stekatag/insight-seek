import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FAQProps {
  question: string;
  answer: string;
  value: string;
}

const FAQList: FAQProps[] = [
  {
    question: "How does InsightSeek analyze GitHub repositories?",
    answer:
      "InsightSeek connects securely to your GitHub account and analyzes repositories using advanced AI models. It processes code structure, dependencies, commit history, and documentation to provide deep understanding of your codebase. For best results, we recommend repositories with up to 1000 files.",
    value: "item-1",
  },
  {
    question: "What file formats are supported for meeting analysis?",
    answer:
      "InsightSeek supports most common audio formats including MP3, WAV, and M4A. Video formats are not supported, please provide audio files for analysis. For best results, we recommend clear audio recordings with minimal background noise and file sizes up to 100 MB. There is no limit to the length of the audio file, but for best results we recommend up to 3 hours.",
    value: "item-2",
  },
  {
    question: "How secure is my repository and meeting data?",
    answer:
      "Security is our top priority. InsightSeek uses end-to-end encryption and never stores your source code permanently. Meeting recordings are processed securely and can be automatically deleted after analysis. We comply with industry-standard security practices and GDPR regulations.",
    value: "item-3",
  },
  {
    question: "Can I share insights with team members?",
    answer:
      "Yes! InsightSeek is designed for collaboration. You can share specific insights, repository analyses, and meeting summaries with team members by generating shareable links or adding them directly to your workspace. Access controls let you determine what information is visible to different team members.",
    value: "item-4",
  },
  {
    question: "Is there a limit to repository size or meeting length?",
    answer:
      "There are no limits to repository size, but for best results, we recommend repositories with up to 1000 files. For meetings, we recommend audio files up to 100 MB. There is no limit to the length of the audio file, but for best results we recommend up to 3 hours.",
    value: "item-5",
  },
  {
    question: "How accurate is the meeting transcription?",
    answer:
      "Our AI transcription achieves over 95% accuracy for clear audio with standard English speakers. Accuracy may vary for heavily accented speech, technical jargon, or poor audio quality. Premium users can manually edit transcripts to correct any errors.",
    value: "item-6",
  },
];

export const FAQSection = () => {
  return (
    <section id="faq" className="container md:w-[700px] py-24 sm:py-32">
      <div className="text-center mb-8">
        <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
          FAQ
        </h2>

        <h2 className="text-3xl md:text-4xl text-center font-bold">
          Common Questions
        </h2>
      </div>

      <Accordion type="single" collapsible className="AccordionRoot">
        {FAQList.map(({ question, answer, value }) => (
          <AccordionItem key={value} value={value}>
            <AccordionTrigger className="text-left">
              {question}
            </AccordionTrigger>

            <AccordionContent>{answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
};
