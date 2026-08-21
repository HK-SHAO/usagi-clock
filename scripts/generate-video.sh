#!/bin/bash
# 将帧图片序列打包为单个 MP4 视频文件（H.264）
# 配合 Blob URL 一次性加载到内存，不依赖服务器 Range 请求
#
# 关键：先将 WebP 转为 PNG 再编码，消除 WebP 解码器差异导致的帧偏移
#       (WebP→H.264 SSIM≈0.936, PNG→H.264 SSIM≈0.994)
set -e

ASSETS_DIR="$(cd "$(dirname "$0")/../assets" && pwd)"
FRAMES_DIR="$ASSETS_DIR/frames_compressed"
OUTPUT="$ASSETS_DIR/animation.mp4"
TEMP_DIR=$(mktemp -d)
PNG_DIR=$(mktemp -d)

trap 'rm -rf "$TEMP_DIR" "$PNG_DIR"' EXIT

# frameNumbers 数组（与 config.ts 保持一致）
FRAME_NUMBERS=(
  552 556 560 563 567 571 575 578 582 597 601 605 608 646 678
  688 690 691 692 693 695 696 697 698 700 701 702 703 705 706
  707 708 710 711 712 713 715 716 717 718 720 721 722 723 725
  726 727 728 730 731 732 733 735 736 737 738 740 741 742 743
  745 746 747 748 750 751 752 753 755 756 757 758 760 761 762
  763 765 766 767 768 770 771 772 773 775 776 777 778 780 781
  782 783 785 786 787 788
)

START=552
END=788

echo "📐 展开帧序列：$START → $END ($(($END - $START + 1)) 帧)..."

# 展开完整帧列表并创建编号 symlink
CUR=${FRAME_NUMBERS[0]}
IDX=0
for ((i = START; i <= END; i++)); do
  if [ $IDX -lt ${#FRAME_NUMBERS[@]} ] && [ ${FRAME_NUMBERS[$IDX]} -eq $i ]; then
    CUR=$i
    IDX=$((IDX + 1))
  fi
  printf -v NUM "%03d" $((i - START))
  ln -sf "$FRAMES_DIR/${CUR}.webp" "$TEMP_DIR/${NUM}.webp"
done

TOTAL=$((END - START + 1))

echo "🔄 转换 WebP → PNG（消除解码器差异）..."
for ((i = 0; i < TOTAL; i++)); do
  printf -v NUM "%03d" $i
  ffmpeg -y -i "$TEMP_DIR/${NUM}.webp" -update 1 "$PNG_DIR/${NUM}.png" 2>/dev/null
done

echo "🎬 编码 $TOTAL 帧 → MP4 (H.264, 30fps)..."

ffmpeg -y -framerate 30 -i "$PNG_DIR/%03d.png" \
  -c:v libx264 -preset slow -crf 14 \
  -profile:v high -level 4.0 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -frames:v $TOTAL \
  "$OUTPUT" 2>&1

echo ""
echo "✅ 视频已生成：$OUTPUT"
ls -lh "$OUTPUT"
