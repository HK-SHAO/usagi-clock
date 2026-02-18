#!/usr/bin/env python3
"""
提取视频13-28秒的帧，使用相似度去重后以实际帧编号命名。
"""

import os
import shutil
import subprocess

import cv2
import numpy as np

VIDEO_PATH = "assets/ckw.mp4"
OUTPUT_DIR = "assets/frames"
START_SEC = 13
END_SEC = 28
SIMILARITY_THRESHOLD = 0.99  # 相似度阈值，大于等于此值视为重复帧


def get_video_info(path):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    return fps, total_frames


def clear_dir(d):
    if os.path.exists(d):
        shutil.rmtree(d)
    os.makedirs(d, exist_ok=True)


def calculate_similarity(frame1, frame2):
    """
    计算两帧的相似度，返回0-1之间的值，1表示完全相同。
    使用结构相似性指数(SSIM)的计算思路，通过比较亮度和对比度。
    """
    if frame1 is None or frame2 is None:
        return 0.0

    # 确保图像尺寸相同
    if frame1.shape != frame2.shape:
        return 0.0

    # 转换为灰度图
    gray1 = cv2.cvtColor(frame1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(frame2, cv2.COLOR_BGR2GRAY)

    # 转换为float32
    gray1 = gray1.astype(np.float32)
    gray2 = gray2.astype(np.float32)

    # 计算均值
    mu1 = cv2.blur(gray1, (11, 11))
    mu2 = cv2.blur(gray2, (11, 11))

    # 计算方差和协方差
    mu1_sq = mu1 * mu1
    mu2_sq = mu2 * mu2
    mu1_mu2 = mu1 * mu2

    sigma1_sq = cv2.blur(gray1 * gray1, (11, 11)) - mu1_sq
    sigma2_sq = cv2.blur(gray2 * gray2, (11, 11)) - mu2_sq
    sigma12 = cv2.blur(gray1 * gray2, (11, 11)) - mu1_mu2

    # SSIM常数
    c1 = (0.01 * 255) ** 2
    c2 = (0.03 * 255) ** 2

    # 计算SSIM
    ssim_map = ((2 * mu1_mu2 + c1) * (2 * sigma12 + c2)) / (
        (mu1_sq + mu2_sq + c1) * (sigma1_sq + sigma2_sq + c2)
    )

    # 返回平均SSIM值
    return float(np.mean(ssim_map))


def main():
    clear_dir(OUTPUT_DIR)

    fps, total_frames = get_video_info(VIDEO_PATH)
    print(f"视频信息: {fps:.2f} FPS, {total_frames} 总帧数")

    start_frame = int(START_SEC * fps)
    end_frame = int(END_SEC * fps)
    end_frame = min(end_frame, total_frames - 1)

    print(f"提取范围: 第 {start_frame} 帧 到 第 {end_frame} 帧")

    # 使用ffmpeg提取所有帧到临时目录
    temp_dir = "/tmp/frame_extract_temp"
    clear_dir(temp_dir)

    duration = END_SEC - START_SEC
    cmd = [
        "ffmpeg",
        "-y",
        "-ss",
        str(START_SEC),
        "-t",
        str(duration),
        "-i",
        VIDEO_PATH,
        "-vf",
        f"fps={fps}",
        "-frame_pts",
        "1",
        "-q:v",
        "2",
        os.path.join(temp_dir, "%d.png"),
    ]

    print("提取帧中...")
    subprocess.run(cmd, check=True, capture_output=True)

    # 获取提取的帧文件列表，计算实际帧编号
    frame_files = sorted(
        [f for f in os.listdir(temp_dir) if f.endswith(".png")],
        key=lambda x: int(x.split(".")[0]),
    )

    prev_frame = None
    saved_count = 0

    print(
        f"处理 {len(frame_files)} 个帧，使用相似度阈值 {SIMILARITY_THRESHOLD} 去重中..."
    )

    for frame_file in frame_files:
        frame_num_in_segment = int(frame_file.split(".")[0])
        actual_frame_num = (
            start_frame + frame_num_in_segment - 1
        )  # ffmpeg -frame_pts starts from 1

        frame_path = os.path.join(temp_dir, frame_file)
        frame = cv2.imread(frame_path)

        if frame is None:
            continue

        # 相似度对比
        if prev_frame is not None:
            similarity = calculate_similarity(frame, prev_frame)
            if similarity >= SIMILARITY_THRESHOLD:
                continue  # 跳过相似帧

        # 保存帧，使用实际帧编号命名
        output_path = os.path.join(OUTPUT_DIR, f"{actual_frame_num}.png")
        cv2.imwrite(output_path, frame)
        saved_count += 1
        prev_frame = frame

    # 清理临时目录
    shutil.rmtree(temp_dir)

    print("\n完成!")
    print(f"  总帧数: {len(frame_files)}")
    print(f"  保存帧数: {saved_count}")
    print(f"  删除重复: {len(frame_files) - saved_count}")
    print(f"  输出目录: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
