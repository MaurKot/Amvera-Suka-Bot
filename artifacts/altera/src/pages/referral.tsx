import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useGetCharacter } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getReferralInfo, redeemReferral } from "@/lib/api";
import { Copy, Gift, Users } from "lucide-react";
import { haptic } from "@/lib/telegram";

export function ReferralPage() {
  const { data: characterData } = useGetCharacter();
  const character = characterData?.character;
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const info = useQuery({
    queryKey: ["referral"],
    queryFn: getReferralInfo,
    enabled: !!character,
  });

  const redeem = useMutation({
    mutationFn: (c: string) => redeemReferral(c),
    onSuccess: (data) => {
      haptic("success");
      setMsg({ kind: "ok", text: `Друг ${data.referrerName} получил награду! Тебе зачислено ⌬ ${data.rewardSilver}.` });
      setCode("");
      info.refetch();
    },
    onError: (err: Error) => {
      haptic("error");
      setMsg({ kind: "err", text: err.message });
    },
  });

  const copy = async () => {
    if (!info.data) return;
    try {
      await navigator.clipboard.writeText(info.data.inviteLink);
      haptic("success");
      setMsg({ kind: "ok", text: "Ссылка скопирована." });
    } catch {
      haptic("error");
    }
  };

  if (!character) {
    return (
      <Layout title="Друзья">
        <div className="flex-1 flex items-center justify-center text-muted-foreground font-serif italic">
          Сначала создай персонажа.
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Друзья" subtitle="Призывай союзников — получай серебро">
      <Card className="bg-card/70 border-primary/20 mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-primary text-base flex items-center gap-2">
            <Gift className="h-4 w-4" /> Твоя приглашающая печать
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Код</div>
            <div className="font-mono text-xl text-primary tracking-widest" data-testid="referral-code">
              {info.data?.code ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Ссылка</div>
            <div className="flex gap-2">
              <Input readOnly value={info.data?.inviteLink ?? ""} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="Скопировать">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Stat label="Тебе за друга" value={`⌬ ${info.data?.rewardForYou ?? 0}`} />
            <Stat label="Другу" value={`⌬ ${info.data?.rewardForFriend ?? 0}`} />
            <Stat label="Призвано" value={String(info.data?.invitedCount ?? 0)} />
            <Stat label="Заработано" value={`⌬ ${info.data?.totalEarned ?? 0}`} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/70 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Тебя пригласили?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Введи код друга"
            className="font-mono uppercase tracking-widest"
            data-testid="referral-input"
          />
          <Button
            type="button"
            className="w-full"
            disabled={!code.trim() || redeem.isPending}
            onClick={() => redeem.mutate(code.trim())}
            data-testid="referral-submit"
          >
            Активировать печать
          </Button>
          {msg && (
            <div
              className={
                msg.kind === "ok"
                  ? "text-xs text-primary border border-primary/30 bg-primary/10 rounded p-2"
                  : "text-xs text-destructive border border-destructive/30 bg-destructive/10 rounded p-2"
              }
            >
              {msg.text}
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border/40 rounded p-2 bg-background/40">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}
