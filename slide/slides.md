---
theme: default
title: なぜ「3〜4人の輪」だけ難しいのか
info: |
  二部グラフの最大重みマッチングとは何か、なぜ輪の探索がそれに分解できるのかを図解する。
class: text-center
transition: slide-left
mdc: false
css: unocss
---

# なぜ「3〜4人の輪」だけ難しいのか

## 二部グラフの最大重みマッチングへの分解

---
layout: default
---

# MeetU がやりたいこと

<div class="text-lg mt-10 space-y-6">

<div>いらないものを、欲しい人に回す。<br/>2人だけでなく、<b>3〜4人の輪</b>でも成立させたい。</div>

<div v-click>これは<b>CycleFinder</b>が「誰が誰から受け取り、誰に渡すか」を決めるグラフの問題として解いている。</div>

</div>

<div v-click class="mt-10 text-center text-xl font-bold">
じゃあ、一番いい組み合わせをどうやって見つけるのか？<br/>
<span class="text-base font-normal opacity-70">──ここに「二部グラフの最大重みマッチング」という道具が関係してくる。</span>
</div>

---
layout: default
---

# なぜ「人数の上限なし」だけは簡単になるのか

<div class="text-base mt-4 mb-2">
「1人につき頂点を2つに分裂させる」というトリックを使う。
</div>

<div class="flex justify-center mt-6">
<VertexSplitMatching stage="split" />
</div>

<div class="mt-8 text-center text-base opacity-80">
Aさん・Bさん・Cさんは、もともと<b>「渡す」も「受け取る」も両方やる同じ1人</b>。<br/>
これを「渡す役のA」「受け取る役のA」のように<b>2つの頂点に割る</b>。
</div>

---
layout: default
---

# 割った頂点同士を、線で結び直す

<div class="flex justify-center mt-8">
<VertexSplitMatching stage="match" />
</div>

<div class="mt-8 text-center text-base opacity-80 space-y-2">
<div>「Aさんが出せるものを、Bさんが欲しがっている」なら、<br/><b>左の「渡す役のA」から右の「受け取る役のB」へ線を引く</b>。</div>
<div class="mt-4">こうすると「誰が誰から受け取り、誰に渡すか」を決める問題が、<br/><b>左と右、それぞれの頂点をちょうど1回ずつ使い切る組み合わせを選ぶ問題</b>に変わる。</div>
</div>

<div v-click class="mt-6 text-center text-lg font-bold text-green-400">
これが「二部グラフの最大重みマッチング」。<br/>
<span class="text-base font-normal opacity-80">辺の重みの合計が最大になる組み合わせを、多項式時間で厳密に求められる（ハンガリアン法）。</span>
</div>

---
layout: default
---

# 「多項式時間」の中身 ── ハンガリアン法は何をしているのか

<div class="text-base mt-6 space-y-5">

<div class="p-4 rounded-lg bg-gray-800">
n人をn個の役割に割り当てる組み合わせは全部で <b>n!</b> 通り。<br/>
<span class="text-sm opacity-70">n=10 で 10! = 3,628,800 通り。全探索は現実的でない。</span>
</div>

<div v-click class="p-4 rounded-lg bg-gray-800">
ハンガリアン法は全探索しない。<b>双対変数（ポテンシャル）</b>と<b>最短増加路</b>を使い、<br/>
すでに確定したマッチングを<b>1頂点ずつ拡張</b>していく。
</div>

</div>

<div v-click class="mt-8 text-center text-base opacity-80">
未割当の頂点を1つ選ぶ → 既存マッチングに直接追加できるか試す<br/>
→ できなければ増加路を探して更新 → 次の頂点、をn回繰り返す
</div>

<div v-click class="mt-6 text-center text-lg font-bold text-green-400">
1回の頂点拡張が O(n²)。それを n 頂点ぶん繰り返すので<br/>
<span class="text-base font-normal opacity-80">n × O(n²) = <b>O(n³)</b> ── n! ではなく n³ で解けるのがミソ。</span>
</div>

---
layout: default
---

# なぜ「輪の形」に自動的に戻るのか

<div class="text-lg mt-8 space-y-5">

<div class="p-4 rounded-lg bg-gray-800">
左のAが選ばれた（Aが渡す）なら、右のどこかにAから伸びる線が1本ある。<br/>
<span class="text-sm opacity-70">例：A → B</span>
</div>

<div class="p-4 rounded-lg bg-gray-800">
右のBが使われたということは、左の「渡す役のB」も、どこかに線を伸ばさないと帳尻が合わない。<br/>
<span class="text-sm opacity-70">例：B → C</span>
</div>

<div class="p-4 rounded-lg bg-gray-800">
これをたどっていくと、人数が有限である以上、<b>必ずどこかで出発点に戻ってきて輪になる。</b>
</div>

</div>

<div v-click class="mt-8 text-center text-lg font-bold">
輪の長さは、マッチングの結果として<b>勝手に決まる</b>。<br/>
<span class="text-base font-normal opacity-70">3人になるか100人になるかを、事前に制御していない ── だから「上限なし」。</span>
</div>

---
layout: default
---

# じゃあ「3人固定」でも同じように二部グラフにすればいいのでは？

<div class="mt-10 text-center text-2xl leading-relaxed">
自然な発想。<br/>
実際、<b>二部グラフを作るところまでは</b>まったく同じようにできる。
</div>

<div v-click class="mt-12 text-center text-xl opacity-80">
問題は、その先。<br/>
<b>「輪の長さを3人に絞る」を、二部グラフの中でどう表現するか。</b>
</div>

---
layout: default
---

# 3本の線を「セットで」選ぶ必要がある

<div class="flex justify-center mt-6">
<EdgeIndependence :showBundle="false" />
</div>

<div class="mt-6 text-center text-base opacity-80">
A→B→C→A の3人の輪にしたいなら、<br/>
<b>この3本の線が全部そろって初めて、1つの輪</b>になる。
</div>

---
layout: default
---

# でも普通のマッチングは、線を1本ずつ独立に選ぶ

<div class="flex justify-center mt-6">
<EdgeIndependence :showBundle="true" />
</div>

<div class="mt-6 text-center text-lg">
「この3本はセットで選ぶか、セットで選ばないかのどちらかにしろ」<br/>
という<b>線同士の相関関係</b>を、普通の二部マッチングは表現できない。
</div>

<div v-click class="mt-6 text-center text-lg font-bold text-amber-400">
この「セット縛り」を無理やり付け足そうとした瞬間、<br/>
話は簡単な二部マッチングではなくなる。
</div>

---
layout: default
---

# 「セット縛り」を付け足すと、何と同じ形になるか

<div class="text-lg mt-8 space-y-5">

<div class="p-4 rounded-lg bg-gray-800">
「このグループの中から、ちょうど1つだけ選べ」<br/>
「これを選んだら、あれは選べない」<br/>
<span class="text-sm opacity-70">──こういう“セットの中からの二者択一”を大量に積み重ねる問題は、Vertex Cover のような別の難問と同じ構造になる。</span>
</div>

<div class="p-4 rounded-lg bg-gray-800">
これが以前の壁打ちで見た「クランプ」というパーツの正体。<br/>
<span class="text-sm opacity-70">3〜4人という長さの選択肢があると、この“セットの二者択一”を組み立てる余地が生まれてしまう。</span>
</div>

</div>

<div v-click class="mt-8 text-center text-xl font-bold">
だから「3人固定で二部グラフ」は、<b>作るところまでは同じでも、解く難しさが別物になる。</b>
</div>

---
layout: default
---

# 参考：2人組や大人数の輪なら、実は簡単

<div class="grid grid-cols-3 gap-5 mt-10 text-center">

<div class="p-5 rounded-xl bg-green-50 dark:bg-green-900 dark:bg-opacity-25">
<div class="font-bold text-lg mb-2">2人組だけ</div>
<div class="text-sm opacity-80">誰と誰がペアか、決めるだけ。<br/>取り合いになっても、他のペアへの影響が小さい。</div>
<div class="mt-4 font-bold text-green-400">得意</div>
</div>

<div class="p-5 rounded-xl bg-red-50 dark:bg-red-900 dark:bg-opacity-25">
<div class="font-bold text-lg mb-2">3〜4人の輪<span class="text-xs opacity-60 ml-1">MeetU</span></div>
<div class="text-sm opacity-80">人数を区切ると、頂点分裂のトリックが使えない。<br/>1人の行き先が、輪全体・さらに他の輪にまで波及する。</div>
<div class="mt-4 font-bold text-red-400">苦手 ← いまここ</div>
</div>

<div class="p-5 rounded-xl bg-green-50 dark:bg-green-900 dark:bg-opacity-25">
<div class="font-bold text-lg mb-2">何人でもOKな輪</div>
<div class="text-sm opacity-80">人数の上限がなければ、<br/>全員をつなげて1つの大きな輪にすればいい。</div>
<div class="mt-4 font-bold text-green-400">得意</div>
</div>

</div>

<div class="mt-8 text-center text-base opacity-70">
難しいのは「輪の作り方」ではなく、<b>「3〜4人ぴったりで区切る」という条件そのもの</b>。<br/>
（人数の上限を無くせば良いのでは？と思うかもしれないが、輪が長いほど1人の離脱で全員が止まるリスクが増える。だから MeetU では上限を残す。）
</div>

---
layout: default
---

# じゃあ MeetU は、この難しい問題をどう解いているのか

<div class="mt-10 text-center text-2xl leading-relaxed">
厳密な最適解を保証する方法はない。<br/>
だから MeetU は<b>「全部は試さず、良さそうな輪から順に見る」</b>やり方で妥協している。
</div>

<div v-click class="mt-10 text-center text-lg opacity-80">
それが <code>CycleFinder</code>。
</div>

---
layout: default
---

# 今 MeetU が実際にやっていること

<div class="text-lg mb-4">
<b>CycleFinder</b>：起点になる1枚のカードから、輪をたどっていく</div>

<div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-5 mt-6 text-base items-start">

<div class="px-3 py-1 rounded-lg bg-blue-900 bg-opacity-40 font-bold whitespace-nowrap">① 出発</div>
<div>登録された「譲りますカード」を1枚選ぶ。そこから輪の探索が始まる。</div>

<div class="px-3 py-1 rounded-lg bg-blue-900 bg-opacity-40 font-bold whitespace-nowrap">② 次を探す</div>
<div>その「欲しい」条件に合う相手を探す。<b>合う相手が複数いたら、条件が近い順に上位5人だけ</b>見る（それ以上は見ない）。</div>

<div class="px-3 py-1 rounded-lg bg-blue-900 bg-opacity-40 font-bold whitespace-nowrap">③ くり返す</div>
<div>3人か4人になるまで、②を繰り返してたどっていく。</div>

<div class="px-3 py-1 rounded-lg bg-blue-900 bg-opacity-40 font-bold whitespace-nowrap">④ 輪が閉じたら採用</div>
<div>たどっていった先が①の出発点に戻ってきたら、輪の完成。<b>これを最大5個</b>見つけたら探索終了。</div>

</div>

<div v-click class="mt-8 p-4 rounded-lg bg-amber-100 dark:bg-amber-900 dark:bg-opacity-30 text-center">
今は ②「条件が近い順」も ④「採用する輪」も、<b>距離を見ていない</b>し、<br/>
同じ人が複数の輪の候補に同時に出てきたときの<b>衝突の調整もしていない</b>。
</div>

---
layout: default
---

# 距離を入れるとどう変わるか

<div class="grid grid-cols-2 gap-8 mt-8">

<div class="p-5 rounded-xl bg-gray-800">
<div class="font-bold text-lg mb-3 opacity-90">Before</div>
<div class="text-sm space-y-3 opacity-80">
<div>② 次を探す：<b>条件が合う順</b>で上位5人</div>
<div>④ 輪が見つかったら：<b>輪の人数が少ない順</b>で採用</div>
<div>同じ人の取り合い：<b>調整なし（両方提案してしまう）</b></div>
</div>
</div>

<div class="p-5 rounded-xl bg-green-900 bg-opacity-30 border border-green-700">
<div class="font-bold text-lg mb-3 text-green-300">After</div>
<div class="text-sm space-y-3">
<div>② 次を探す：条件が合う人の中で <b class="text-green-300">近い順</b>に上位5人</div>
<div>④ 輪が見つかったら：<b class="text-green-300">輪全体の移動距離の合計が短い順</b>で採用</div>
<div>同じ人の取り合い：<b class="text-green-300">距離が近い候補から確定させ、使われた人・カードは他の候補から除外</b></div>
</div>
</div>

</div>

<div class="mt-8 text-center text-base opacity-80">
探し方の骨組みは変えない。<br/>
「何を基準に良し悪しを決めるか」を<b>タグの一致度 → 距離</b>に変え、<b>取り合いの調整</b>を新しく足す。
</div>

---
layout: default
---

# これで解決するのか

<div class="text-lg mt-8 space-y-5">

<div class="p-4 rounded-lg bg-green-900 bg-opacity-20 border border-green-700">
<b>改善する</b>：距離が近い相手が優先され、同じ人が複数の輪で取り合いにならなくなる。
</div>

<div class="p-4 rounded-lg bg-gray-800">
<b>変わらない</b>：これは「良さそうな輪から順に見る」やり方のまま。<br/>
<span class="text-sm opacity-70">3〜4人固定という条件がある以上、「全体で本当に一番いい割り当て」を保証する方法はない。</span>
</div>

</div>

<div v-click class="mt-8 text-center text-lg font-bold">
最適だと証明はできないが、今より確実に良くなる。<br/>
<span class="text-base font-normal opacity-70">詳細: <code>docs/ADR-004.md</code></span>
</div>

---
layout: default
---

# まとめ

<div class="grid grid-cols-3 gap-4 mt-10 text-center">

<div class="p-5 rounded-xl bg-green-50 dark:bg-green-900 dark:bg-opacity-25">
<div class="text-2xl mb-3">2人組</div>
誰と誰がペアか、決めるだけ
<div class="mt-4 font-bold text-green-400">得意</div>
</div>

<div class="p-5 rounded-xl bg-red-50 dark:bg-red-900 dark:bg-opacity-25">
<div class="text-2xl mb-3">3〜4人の輪</div>
頂点分裂のトリックが使えず、1人の取り合いが輪全体に波及する
<div class="mt-4 font-bold text-red-400">苦手 ← いまここ</div>
</div>

<div class="p-5 rounded-xl bg-green-50 dark:bg-green-900 dark:bg-opacity-25">
<div class="text-2xl mb-3">何人でもOK</div>
上限がなければ1つの輪にまとめられる
<div class="mt-4 font-bold text-green-400">得意</div>
</div>

</div>

<div class="mt-12 text-center text-xl">
難しいのは作り方ではなく、<b>「3〜4人で回す」という約束そのもの</b>。
</div>
