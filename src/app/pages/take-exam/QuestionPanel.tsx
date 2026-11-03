import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";

import { MathText } from "../../components/MathText";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Textarea } from "../../components/ui/textarea";
import type { SessionQuestion } from "./types";

type QuestionPanelProps = {
  question: SessionQuestion;
  index: number;
  totalQuestions: number;
  onToggleMarked: () => void;
  onEssayChange: (text: string) => void;
  onEssayBlur: () => void;
  onOptionChange: (optionKey: string) => void;
  onPrevious: () => void;
  onNext: () => void;
};

export function QuestionPanel({
  question,
  index,
  totalQuestions,
  onToggleMarked,
  onEssayChange,
  onEssayBlur,
  onOptionChange,
  onPrevious,
  onNext,
}: QuestionPanelProps) {
  const { t } = useTranslation("common");
  return (
    <Card>
      <CardContent className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-900">
                  {t("examSession.questionHeading", { number: index + 1 })}
                </h2>
                <Badge variant="outline">{t(`examSession.difficulty.${question.difficulty}`, { defaultValue: question.difficulty })}</Badge>
                <Badge variant="outline">{t(`examSession.questionType.${question.question_type}`, { defaultValue: question.question_type.replace(/_/g, " ") })}</Badge>
              </div>
              <p className="text-xs text-gray-500">{t("examSession.points", { points: question.points })}</p>
            </div>
            <Button variant="outline" size="sm" className="w-full gap-2 sm:w-auto" onClick={onToggleMarked}>
              <Flag className="w-4 h-4" />
              {question.is_marked_for_review ? t("examSession.unmark") : t("examSession.markForReview")}
            </Button>
          </div>
          <p className="text-base leading-relaxed text-gray-800 sm:text-lg">
            <MathText text={question.question_text} />
          </p>
        </div>

        {question.question_type === "essay" ? (
          <Textarea
            rows={10}
            value={question.answer_text}
            onChange={(event) => onEssayChange(event.target.value)}
            onBlur={onEssayBlur}
            placeholder={t("examSession.answerPlaceholder")}
          />
        ) : (
          <div className="space-y-3">
            <RadioGroup
              value={question.selected_option_keys[0] ?? undefined}
              onValueChange={onOptionChange}
            >
              {question.options.map((option, optionIndex) => {
                const isSelected = question.selected_option_keys.includes(option.key);
                return (
                  <label
                    key={option.key}
                    className={`flex items-start gap-4 rounded-lg border-2 p-4 transition-colors ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <RadioGroupItem value={option.key} id={`option-${option.key}`} />
                    <Label htmlFor={`option-${option.key}`} className="flex-1 cursor-pointer text-base">
                      <span className="font-medium text-gray-700 mr-2">{String.fromCharCode(65 + optionIndex)}.</span>
                      <MathText text={option.text} />
                    </Label>
                  </label>
                );
              })}
            </RadioGroup>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Button className="w-full sm:w-auto" variant="outline" onClick={onPrevious} disabled={index === 0}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            {t("examSession.previous")}
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={onNext}
            disabled={index === totalQuestions - 1}
          >
            {t("examSession.next")}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
