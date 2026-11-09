# Shinobi Siege

Game phòng thủ làng ninja góc nhìn từ trên xuống, lấy cảm hứng từ bối cảnh Naruto, chạy local và không cần thư viện ngoài. Bạn khởi đầu với Trượng Lục Đạo, sau đó có thể rút song kiếm Susanoo, hóa Baryon/Cửu Vĩ đỏ, triệu hồi Thập Vĩ, Might Guy và bốn Hokage đời đầu để đẩy lùi Akatsuki cùng các trùm Ōtsutsuki.

## Khởi động trên Windows

1. Nhấp đúp `start.bat`.
2. Mở `http://localhost:8080` nếu trình duyệt chưa tự mở.
3. Giữ cửa sổ PowerShell mở khi chơi; nhấn `Ctrl+C` để tắt server.

Script ưu tiên Node.js, sau đó thử Python. Nếu máy không có cả hai, script sẽ mở trực tiếp `index.html` để chơi offline.

## Co-op · đánh boss cùng bạn (tối đa 4 người)

Chế độ co-op cần chạy server bằng **Node.js** (`start.bat`). Python và mở trực tiếp `index.html` chỉ chơi được chế độ đơn.

1. Người làm chủ phòng chạy `start.bat`. Cửa sổ PowerShell sẽ in thêm các địa chỉ LAN, ví dụ `http://192.168.1.20:8080`. Nếu Windows Firewall hỏi, hãy cho phép Node.js truy cập mạng riêng (Private).
2. Ở màn hình đầu, nhập tên ninja rồi bấm **TẠO PHÒNG**. Phòng chờ hiện mã 4 chữ cái và các địa chỉ để gửi cho bạn bè.
3. Bạn bè cùng mạng Wi-Fi/LAN mở địa chỉ đó trên máy mình, nhập tên và mã phòng, rồi bấm **VÀO PHÒNG**. Mỗi phòng tối đa 4 người.
4. Chủ phòng bấm **BẮT ĐẦU** để chơi Bảo Vệ Làng cùng nhau, hoặc **ĐẤU ĐỘI · CHỌN ĐỘI HÌNH** để chơi Đấu Đội (xem dưới). Người vào sau khi trận đã bắt đầu sẽ nhảy thẳng vào trận đang diễn ra.

**Đấu Đội co-op** (tối đa 4 người):

- Chủ phòng bấm **ĐẤU ĐỘI · CHỌN ĐỘI HÌNH** trong phòng chờ, xếp các đội như Đấu Đội thường rồi bấm BẮT ĐẦU.
- **Mọi người cùng xếp đội**: khi chủ phòng mở màn TẠO ĐỘI, màn đó cũng hiện trên máy bạn bè. Mỗi người bấm **＋ TÔI VÀO ĐỘI NÀY** trên một thẻ đội (nhiều người chung đội được), rồi bấm nhân vật bên phải để thêm vào đội của mình, bấm vào nhân vật trong đội để bỏ. Khách chỉ sửa được đội mình đang ở; số đội, tên đội, cờ xuất phát và nút BẮT ĐẦU do chủ phòng quyết. Khách đóng màn này thì quay về phòng chờ, có nút mở lại.
- Nhiều người cùng một đội thì đánh chung; khác đội thì đấu với nhau. Naruto do chủ phòng điều khiển chỉ nằm ở đội chủ phòng đã vào; Naruto ở đội khác do máy điều khiển.
- Ai chưa chọn thì khi vào trận sẽ hiện bảng **CHỌN ĐỘI** (hoặc **CHỈ XEM**).
- Mỗi người điều khiển một nhân vật của đội mình, cách bấm như Đấu Đội: WASD đi, chuột trái tung chiêu liên hoàn, chuột phải lướt, `Tab` đổi sang nhân vật khác của đội (không lấy được nhân vật người khác đang điều khiển). Nhân vật gục thì bạn tự sang nhân vật khác còn sống của đội. `J` mở lại bảng chọn đội, `Backspace` chỉ xem.
- Naruto chỉ chủ phòng điều khiển được. Chỉ chủ phòng thêm quân (`N`) và bắt đầu lại trận.
- Máy chủ phòng chạy toàn bộ trận; máy khách gửi phím và chuột lên, nên mạng chậm thì nhân vật của khách phản hồi trễ một chút.

Trong trận co-op:

- Máy chủ phòng điều khiển kẻ địch, boss Akatsuki/Ōtsutsuki và Vĩ Thú. Mỗi người tự điều khiển Naruto của mình với đầy đủ nhẫn thuật, Baryon, triệu hồi Thập Vĩ, Might Guy và Hokage, và nhìn thấy chiêu cùng đồng minh của đồng đội.
- Mỗi người có vòng màu và tên riêng dưới chân. Bảng **ĐỒNG ĐỘI** trên HUD hiện máu của cả đội; bản đồ nhỏ và bản đồ lớn hiện vị trí đồng đội.
- Địch đánh người gần nhất. Chấn động diện rộng và Vĩ Thú Ngọc trúng tất cả những ai đứng trong vùng.
- Điểm và số địch hạ là của chung cả đội. Ai tung đòn kết liễu Vĩ Thú thì được hồi máu và giáp; ai kết liễu boss cũng được hồi máu và giáp.
- Nhà bị phá sập giống nhau trên máy mọi người.
- Hết máu thì bạn **gục** 6 giây rồi hồi sinh cạnh một đồng đội còn đứng với 60% máu. Trận chỉ thua khi cả đội cùng gục. Khi đó chỉ chủ phòng chơi lại được (phím `R` hoặc nút **CHƠI LẠI CẢ ĐỘI**).
- `Esc` mở menu nhưng trận vẫn tiếp diễn; nút **RỜI PHÒNG CO-OP** nằm trong menu này. Nếu chủ phòng rời đi, phòng đóng và mọi người quay về màn hình chính.
- Chơi qua Internet (khác mạng) cần mở cổng 8080 trên router hoặc dùng một dịch vụ tunnel trỏ về máy chủ phòng.

## Hình ảnh

- Nhìn từ trên xuống theo góc 3/4: nhân vật đứng thẳng, vẽ theo phong cách anime (`anime-sprites.js`), chạy kiểu ninja tay vung ra sau, kết ấn khi niệm thuật và vươn tay khi tung đòn.
- Naruto (áo cam đen, băng trán Làng Lá, ria mèo) hóa Baryon có áo choàng lửa đỏ cam, sừng chakra và chín đuôi. Ninja địch có băng trán làng Sương Mù, Mây, Đá và Âm Thanh. Akatsuki mặc áo choàng mây đỏ, Ōtsutsuki có sừng và Byakugan. Hokage, Might Guy và Thập Vĩ đều có ngoại hình riêng.
- Rasengan nằm trong lòng bàn tay, Rasen Shuriken giơ cao trên đầu. Hỏa cầu, Chidori, Vĩ Thú Ngọc và khói "bùm" của Ảnh Phân Thân đều được vẽ lại; phi tiêu, kunai và nhẫn thuật bay ngang ngực, có bóng dưới đất.
- Toàn bộ hình ảnh được vẽ bằng code (Canvas), không dùng ảnh gốc từ phim.
- Đồ hoạ WebGL (`postfx.js`): mỗi khung hình được đưa qua GPU để chiêu thức phát sáng lan ra như phim (bloom), các cú va chạm lớn tạo sóng xung kích làm méo không gian, rung mạnh thì tách màu. Bấm `P` để bật/tắt; máy không hỗ trợ WebGL2 sẽ tự dùng hình Canvas thường.
- Số máu bay lên trên đầu ở mọi chế độ: trúng chiêu hiện số sát thương (trắng; vàng/cam khi đòn nặng), bạn hoặc phe mình mất máu hiện số đỏ có dấu `-`, hồi máu (chiêu hồi, hồi máu theo trạng thái, Ngạ Quỷ Đạo…) hiện số xanh có dấu `+`. Nhiều đòn liên tiếp vào cùng một người được cộng dồn thành một số.
- Tung chiêu không hiện thông báo hay cut-in giữa màn hình. Cut-in (có cận cảnh đôi mắt kiểu anime) chỉ dành cho các sự kiện của Đại Chiến: mở màn, Madara hồi sinh, Lục Đạo Madara xuất hiện và chiến thắng.
- `gallery.html` (mở http://localhost:8080/gallery.html) là bảng thiết kế: mọi nhân vật với đủ tư thế, chân dung và ảnh cận cảnh.

## Cách chơi

- **Thế giới nhẫn giả** (`world-map.js`): Làng Lá nằm giữa rừng Hỏa Quốc, có đường đi tới bốn làng lớn và năm làng nhỏ:
  - Đi ra cửa tây, rồi lên phía bắc qua vùng đá đỏ của Đất Nước Đá: **Làng Đá** (Iwagakure 岩, `village-iwa.js`).
  - Đi ra cửa đông, rồi lên phía bắc qua vùng núi thông của Đất Nước Sấm: **Làng Mây** (Kumogakure 雲, `village-kumo.js`).
  - Đi ra cổng A-Un phía nam, rẽ tây qua sa mạc Đất Nước Gió: **Làng Cát** (Sunagakure 砂, `village-suna.js`).
  - Cũng từ cổng nam, rẽ đông qua cây cầu dài trên biển Đất Nước Nước: đảo **Làng Sương Mù** (Kirigakure 霧, `village-kiri.js`).
  - Năm làng nhỏ (7×7 dãy nhà) nằm trên các đường nhánh:
    - Từ đường tây, rẽ lên phía bắc: **Làng Cỏ** (Kusagakure 草, `village-kusa.js`). Từ đó một con đường chạy ngang phía trên núi Hokage tới **Làng Âm Thanh** (Otogakure 音, `village-oto.js`) và **Làng Thác Nước** (Takigakure 滝, `village-taki.js`), rồi vòng xuống đường đông.
    - Từ đường tây, rẽ xuống phía nam: **Làng Mưa** (Amegakure 雨, `village-ame.js`), nơi mưa không bao giờ tạnh.
    - Từ đường đông, rẽ xuống phía nam: **Làng Suối Nước Nóng** (Yugakure 湯, `village-yu.js`).
  - Mỗi ngã rẽ có biển chỉ đường. Khi bước vào làng hoặc vùng đất mới sẽ hiện tên nơi đó. Bản đồ nhỏ ở góc hiển thị vùng quanh bạn.
  - **Đừng phá nhà!** Nếu bạn (hoặc phân thân, đồng minh của bạn) làm sập một ngôi nhà ở Làng Cát, Làng Sương Mù, Làng Mây hay Làng Đá, cả làng báo động: 40 ninja tinh nhuệ của làng ùa ra săn bạn, và **Kage** của làng xuất hiện (`kage-bosses.js`). Mỗi nhà sập thêm gọi thêm 14 ninja; nếu Kage đã bị hạ, cứ mỗi 4 nhà sập thì Kage quay lại. **Làng Lá cũng vậy:** phá nhà ở Làng Lá thì 40 ninja Làng Lá (áo giáp xanh, Hỏa Độn và kunai bùa nổ) cùng **toàn bộ sáu đời Hokage** (Hashirama, Tobirama, Hiruzen, Minato, Tsunade, Kakashi) kéo ra đánh bạn; Hokage nào bị hạ thì quay lại sau mỗi 4 nhà sập. Nhà do kẻ địch tự phá không tính. Làng nhỏ cũng báo động y như vậy nhưng không có Kage: Làng Mưa gọi Pain, Làng Thác Nước gọi Kakuzu, Làng Suối Nước Nóng gọi Hidan; Làng Âm Thanh và Làng Cỏ chỉ có ninja.
    - **Gaara (Kazekage):** Sa Bộc Tống Táng (quan tài cát bóp nát, bán kính khoảng 160px), Sa Thủ Lý Kiếm (3 loạt phi tiêu cát), Sa Bộc Đại Lãng (tường cát dài khoảng 820px quét tới), Sa Thời Vũ (mưa đạn cát); tuyệt chiêu **Sa Bộc Đại Táng**: cả vùng bán kính khoảng 470px hóa sa mạc, vòng cát khép dần rồi cột cát nện xuống giữa. Có lớp cát Tuyệt Đối Phòng Ngự nên chỉ nhận 70% sát thương.
    - **Mei Terumī (Mizukage):** dòng sông dung nham, sương axit hình quạt, Thủy Long Đạn (rồng nước khoảng 920px), mưa cục dung nham để lại vũng cháy; tuyệt chiêu **Dung Hải**: biển dung nham lan ra bán kính khoảng 560px.
    - **A (Raikage):** Lôi Khải (nổ sét đẩy lùi, sau đó nhanh hơn và chịu ít sát thương hơn trong 9 giây), Lariat, chém sét hình lưỡi liềm, Liger Bomb (nhảy lên rồi nện xuống); tuyệt chiêu **Song Lariat · Lôi Bạo**: mây giông giáng 10 tia sét rồi lao một đường dài khoảng 900px.
    - **Ōnoki (Tsuchikage), bay lơ lửng:** Gia Trọng Nham, Trần Độn (tia trắng dài khoảng 960px xóa sổ mọi thứ, kể cả nhà), Khinh Trọng Nham (ném tảng đá khổng lồ), Nham Nhân (người đá nện 2 lần); tuyệt chiêu **Trần Độn · Cự Lập Phương**: khối lập phương khổng lồ nở ra bán kính khoảng 380px.
    - Ninja các làng mạnh gấp 6–9 lần ninja thường, mỗi làng có chiêu riêng: Làng Cát phóng ba lưỡi gió và thổi bạt; Làng Sương Mù bắn thủy đạn và đột kích bằng kiếm; Làng Mây bắn lôi đạn và lướt sét; Làng Đá ném đá nổ và dậm đất. Ninja làng nhỏ yếu hơn một chút và mượn chiêu: Làng Mưa và Thác Nước dùng thủy độn, Làng Âm Thanh dùng phong/âm, Làng Cỏ dùng thổ độn, Làng Suối Nước Nóng dùng lôi độn. Ngoài ra, cứ khoảng 8–12 giây mỗi ninja làng lại tung **tuyệt kỹ diện rộng**, vùng trúng chiêu hiện đỏ trên mặt đất trước khoảng 0,6–1 giây:
      - Làng Cát: Phong Độn · Đại Đột Phá (quạt gió dài khoảng 460px, thổi bạt) và Sa Phược Cữu (xoáy cát bán kính khoảng 190px, gây sát thương liên tục).
      - Làng Sương Mù: Thủy Long Đạn (rồng nước lao thẳng khoảng 660px) và Đại Bộc Bố (sóng nước hình quạt, đẩy lùi).
      - Làng Mây: Lôi Hải (6 tia sét giáng quanh bạn) và Lôi Xà (tia sét thẳng khoảng 600px).
      - Làng Đá: Gia Trọng Nham (tảng đá rơi, bán kính khoảng 170px) và Địa Thứ (rừng chông đá trồi lên, bán kính khoảng 240px).
      - Làng nhỏ, mỗi làng một chiêu riêng cộng với chiêu mượn: Làng Mưa có Thiên Thủy Châm (mưa kim), Làng Âm Thanh có Hưởng Minh Xuyên (sóng âm), Làng Thác Nước có Bộc Bố Kích (thác nước dội xuống), Làng Cỏ có Gai Cỏ Trói Thân, Làng Suối Nước Nóng có Bộc Nhiệt (3 cột hơi nóng phun lên).
    - Mỗi chiêu Kage đều có vùng cảnh báo và tên chiêu hiện trên đầu để bạn kịp né. Kage và ninja các làng cũng có trong bảng TẠO ĐỊCH.
  - Bấm `M` để mở bản đồ lớn của cả thế giới, bấm vào bất kỳ đâu trên đó để dịch chuyển tức thì (Phi Lôi Thần). Phân thân đi theo bạn.
- Làng Lá (`konoha-world.js`), bản đồ 14×14 dãy nhà:
  - Trung tâm: dinh Hokage tròn đỏ có chữ 火 (bạn xuất phát ngay cạnh), Học viện Ninja có xích đu, quán Ichiraku 一楽, bệnh viện Làng Lá 木ノ葉病院 và dinh thự nhà Hyūga 日向 có hồ cá Koi. Đường đất, nhà tường trắng mái cam/xanh với bồn nước trên mái, cột điện giăng dây.
  - Phía tây: **Rừng Tử Thần** (Sân tập số 44) với cây cổ thụ khổng lồ, hàng rào kẽm gai, cổng 第四十四演習場, biển 立入禁止, và tòa tháp thi Chūnin (天/地) ở giữa rừng.
  - **Sông Naka** chảy từ chân núi Hokage xuống phía nam, có cầu gỗ lan can đỏ ở mỗi ngã tư. Ninja đi được trên mặt nước.
  - Phía đông, bên kia sông: **khu tộc Uchiha** với nhà mái đen, gia huy quạt Uchiha và đền Naka 南賀ノ神社 có cổng torii.
  - Góc đông nam: **Thung lũng Tận cùng**, nơi sông Naka đổ xuống thác giữa hai tượng đá khổng lồ Hashirama và Madara đứng đối mặt kết ấn.
  - Phía bắc là núi mặt Hokage với bảy gương mặt, phía nam là tường làng và cổng A-Un (阿 吽), hai bên là rừng.
- **Kẻ địch mạnh hơn:** mọi kẻ địch (ninja, Kage, Akatsuki, boss, Vĩ Thú) có máu ×1,8 và sát thương ×1,5 so với trước.
- **Không còn đợt địch tự động.** Bấm nút **＋ TẠO ĐỊCH** (góc trên bên phải) hoặc phím `N` để mở bảng triệu tập: chọn số lượng cho từng loại ninja địch (có nút +10/+50), từng thành viên Akatsuki, Kage, Sannin, Hokage, Huyền Thoại, nhóm **Đại Chiến Nhẫn Giả Lần 4** (Madara Uế Thổ, Lục Đạo Madara, Nagato Uế Thổ, Killer Bee), nhóm **Kẻ Thù Truyền Kiếp** (Uchiha Sasuke, Tobi, Zetsu, Danzō, Thập Vĩ), **Kage Đời Trước · Uế Thổ** (Raikage đời 3, Kazekage đời 3, Rasa, Gengetsu, Yagura), **Kage Đời Mới** (Darui, Chōjūrō, Kurotsuchi), **Gia Tộc Uchiha** (Shisui, Fugaku, Indra), **Pain Lục Đạo** (đủ 6 thân), **Đối Thủ · Nhẫn Giả** (Hanzō, Might Guy, Rock Lee), **Konoha · Thế Hệ Mới** (Sakura, Hinata, Neji, Shikamaru, Chōji, Ino, Kiba, Shino, Tenten), **Jōnin Làng Lá** (Yamato, Sai, Asuma, Kurenai), **Làng Cát · Làng Sương Mù** (Kankurō, Temari, Zabuza, Haku), **Âm Nhẫn Ngũ** (Kimimaro, Sakon & Ukon, Tayuya, Kidōmaru, Jirōbō), **Đội Taka · Samurai** (Suigetsu, Jūgo, Karin, Mifune), **Nhân Trụ Lực** (Yugito, Rōshi, Han, Utakata, Fū), **Lục Đạo · Khởi Nguyên** (Hagoromo, Hamura, Ashura), **Thời Boruto · Kara** (Boruto, Sarada, Mitsuki, Kawaki, Jigen, Code, Kashin Koji, Urashiki, Toneri), lính Bạch Zetsu, từng trùm Ōtsutsuki và từng Vĩ Thú (nay có cả **Cửu Vĩ Kurama**), rồi bấm **TẠO ĐỊCH** (hoặc Enter). Mỗi lần tạo tối đa 500 kẻ địch; bản đồ chứa tối đa 600 kẻ địch còn sống cùng lúc. Nút **XOÁ HẾT ĐỊCH TRÊN BẢN ĐỒ** dọn sạch bản đồ. Trò chơi tạm dừng khi bảng đang mở (trừ khi chơi co-op). Trong co-op, ai cũng tạo hoặc xoá địch được; yêu cầu được gửi cho chủ phòng.
- Ninja địch nhanh và mạnh. Mỗi loại có chiêu riêng như phi tiêu, lướt sét, chấn địa hoặc Hỏa Độn. Cứ khoảng 8–12 giây mỗi ninja tung thêm một tuyệt kỹ diện rộng, có vùng cảnh báo đỏ trên mặt đất và tên chiêu nhỏ trên đầu:
  - Ninja phi tiêu: Phi Tiêu Vũ (mưa kunai bán kính khoảng 200px) và Bộc Phù Khổ Vô (3 kunai gắn bùa nổ).
  - Ninja Lôi Độn: Lôi Xà (tia sét thẳng khoảng 600px).
  - Ninja Thổ Độn: Nham Thương (hàng chông đá trồi lên dài khoảng 540px).
  - Ninja Hỏa Độn: Hỏa Long Viêm (luồng lửa hình quạt khoảng 420px) và Hào Hỏa Cầu (cầu lửa lớn nổ rộng).
- Boss Akatsuki có thanh máu riêng, máu và sát thương gấp 5 lần ninja thường. Mỗi thành viên có **5 nhẫn thuật, trong đó 1 tuyệt chiêu**; khoảng 30 giây là ra đủ cả 5 chiêu. Mọi đòn đều có vùng cảnh báo trên mặt đất và tên chiêu nhỏ trên đầu:
  - **Pain:** mưa hắc bổng, Thần La Thiên Chinh (vòm bán kính khoảng 400px, đẩy lùi), tên lửa Tu La Đạo, Vạn Tượng Thiên Dẫn (kéo bạn lại rồi đánh); tuyệt chiêu **Địa Bộc Thiên Tinh**: đá gom thành quả cầu khổng lồ rồi rơi xuống, bán kính khoảng 420px.
  - **Itachi:** Thiên Chiếu (lửa đen cháy dai), bầy quạ, Hào Hỏa Cầu, Nguyệt Đọc (vùng trăng đỏ); tuyệt chiêu **Susanoo · Thập Quyền Kiếm**: đâm kiếm dài khoảng 960px rồi quét vòng, kèm gương Yata giảm sát thương nhận vào.
  - **Kisame:** đàn cá mập nước, Thủy Lao, Samehada lao chém (hút máu), Đại Giao Đạn (cá mập khổng lồ); tuyệt chiêu **Đại Bộc Thủy Xung Ba**: biển nước tràn ra bán kính khoảng 820px.
  - **Deidara:** C1 chim đất sét đuổi theo, C2 rồng thả bom, C3 bom khổng lồ, C4 đám mây bom vi mô; tuyệt chiêu **C0**: vụ nổ bán kính khoảng 650px kèm mây hình nấm.
  - **Sasori:** mưa cát sắt, Bách Cơ Thao Diễn (12 con rối khép vòng), sương độc, hàng gai cát sắt; tuyệt chiêu **Sa Thiết Giới Pháp**: cầu cát sắt nổ thành gai tỏa nhánh.
  - **Kakuzu:** Hỏa Độn Đầu Khắc Khổ, Địa Oán Ngu (chỉ đen quất và cứng người), Lôi Độn Ngụy Ám (tia sét khoảng 960px), Phong Độn Áp Hại; tuyệt chiêu **Ngũ Hành Hợp Kích**: lốc lửa kèm 6 tia sét.
  - **Konan:** bão phi tiêu giấy, bướm giấy nổ, cánh thiên sứ phóng giáo giấy, lốc xoáy giấy đuổi theo; tuyệt chiêu **Sáu Nghìn Ức Giấy Bộc**: thảm bùa nổ trải ra bán kính khoảng 820px rồi nổ dây chuyền.
  - **Hidan:** lưỡi hái ba lưỡi quét vòng, lưỡi hái xích, Tà Thần Trận (vòng máu, hắn hồi máu trong vòng), Huyết Tế (gai máu tỏa ra); tuyệt chiêu **Tà Thần Giáng**: ấn chú khổng lồ bán kính khoảng 470px và 4 ngọn giáo máu.
- Các trùm Ōtsutsuki cực mạnh, mỗi trùm 5–6 chiêu kèm 1 tuyệt chiêu và có thanh máu boss. Hạ boss được hồi 30% máu và +25 giáp.
  - **Momoshiki:** Hấp Thụ Chakra (hút bạn lại, giảm sát thương nhận vào), trả lại Đại Rasengan, hắc bổng, cự quyền kết giới, trả lại Hỏa Độn; tuyệt chiêu **Siêu Đại Ngọc** bán kính khoảng 400px.
  - **Kinshiki:** chém rìu chakra xẻ đất, mưa giáo chakra, bão lưỡi đao, lao rìu; tuyệt chiêu **Hồng Phủ Đại Luân Trảm**: rìu khổng lồ xoay quét bán kính khoảng 480px.
  - **Isshiki:** mưa hắc bổng, khối lập phương Đại Hắc Thiên rơi, hắc bổng phóng to giữa không trung, hàng cột đen; tuyệt chiêu **Cự Lập Phương Giáng**: khối lập phương khổng lồ rơi xuống, bán kính khoảng 360px.
  - **Kaguya, bay lơ lửng:** rừng xương Cộng Sát Hôi Cốt, cổng không gian bắn giáo xương, Bát Quái Không Chưởng, Băng Giới; tuyệt chiêu **Bành Trướng Cầu Đạo Ngọc**: quả cầu đen nở ra bán kính khoảng 540px.
- Bảng Tạo Địch có thêm ba nhóm boss mới, mỗi người 5–7 chiêu kèm 1 tuyệt chiêu, chiêu lớn đều có vùng cảnh báo trên mặt đất:
  - **Sannin** (`sannin-bosses.js`): **Jiraiya** (Đại Ngọc Loa Toàn Hoàn, Cóc Dầu Viêm Đạn, Châm Kim Tiếp Địa, mưa kim tóc, triệu hồi Gamabunta; tuyệt chiêu **Tiên Pháp · Ngũ Hữu Vệ Môn** cùng Ma và Pa: sóng dầu lửa dài 980px). **Orochimaru** (Tiềm Ảnh Xà Thủ, Thảo Tùng Kiếm, Bát Kỳ Thuật, Phong Độn, Manda quấn siết; tuyệt chiêu **Uế Thổ Chuyển Sinh** gọi Hashirama và Tobirama). **Kabuto rắn** (Vô Cơ Chuyển Sinh, Bạch Kích, mưa rắn Long Động, Man Đà La Xà, Uế Thổ gọi Itachi và Deidara; tuyệt chiêu **Tiên Pháp · Đại Xà Long**).
  - **Hokage Làng Lá** (`hokage-bosses.js`, Uế Thổ): **Hashirama** (Mộc Long, Thụ Giới Giáng Đản, Mộc Nhân, rừng hoa; tuyệt chiêu **Chân Số Thiên Thủ** mưa 22 nắm đấm). **Tobirama** (Thủy Long Đạn, Phi Lôi Thần Trảm, Thủy Trận Bích, quan tài Uế Thổ, chuỗi bùa nổ; tuyệt chiêu lũ nước + Phi Lôi Thần). **Hiruzen** (Hỏa Long Viêm Đạn, nghìn phi tiêu, Enma Kim Cương Như Ý/Lao Bích, Thổ Lưu Bích; tuyệt chiêu **Thi Quỷ Phong Tấn**). **Minato** (lưới kunai Phi Lôi Thần, Rasengan dịch chuyển, áo choàng Cửu Vĩ; tuyệt chiêu Kurama bắn **Vĩ Thú Ngọc**). **Tsunade** (Anh Hoa Xung, Thống Thiên Cước, ném đá tảng, Katsuyu phun axit, Bách Hào hồi máu; tuyệt chiêu nắm đấm chakra khổng lồ). **Kakashi** (Lôi Thiết, Thần Uy, Lôi Thú Truy Nha, chó ninja, Thủy Độn, Tử Điện; tuyệt chiêu **Susanoo** xanh ném phi tiêu Thần Uy).
  - **Huyền Thoại** (`legend-bosses.js`): **Đệ Nhất Kazekage Reto** (Đại Đột Phá, Chân Không Đại Ngọc, ba lốc xoáy, mưa lưỡi gió, bão cát; tuyệt chiêu **Phong Sa Đại Bạo** hai lốc cát khổng lồ). **Đệ Nhị Tsuchikage Mu** (Trần Độn Nguyên Giới Bác Ly, đá rơi, tàng hình đánh lén sau lưng, khối lập phương, tách đôi người; tuyệt chiêu quả cầu Trần Độn bán kính 520px). **Obito Lục Đạo**, bay lơ lửng với Cầu Đạo Ngọc (giáo đen, Tích Trượng, Thần Uy, tia Vĩ Thú Ngọc, rễ Thần Thụ, quạt phản hồi; tuyệt chiêu **Cự Vĩ Thú Ngọc Thập Vĩ** nổ bán kính 620px).
- **Vĩ Thú** (`tailed-beasts.js`): tám Vĩ Thú khổng lồ chọn được trong bảng tạo địch: Nhất Vĩ Shukaku, Nhị Vĩ Matatabi, Tam Vĩ Isobu, Tứ Vĩ Son Gokū, Ngũ Vĩ Kokuō, Lục Vĩ Saiken, Thất Vĩ Chōmei và Bát Vĩ Gyūki. Máu rất trâu: khoảng 30.000 cho Nhất Vĩ, càng nhiều đuôi càng cao. Chúng không bị đẩy lùi. Mỗi con có **4 chiêu riêng** theo hệ của mình rồi đến tuyệt chiêu **Vĩ Thú Ngọc**: quả cầu tụ trong miệng 1,6 giây, bay theo vạch cảnh báo rồi nổ bán kính khoảng 290px. Khoảng 15 giây là ra đủ 5 chiêu; dưới 50% máu chúng ra chiêu nhanh hơn. Ví dụ: Shukaku có sóng thần cát dài khoảng 800px và 3 quan tài cát; Matatabi có 9 cột lửa xanh và vòng lửa khép lại; Isobu có rừng san hô và cuộn tròn lăn tới; Son Gokū có mưa dung nham và 30 mạch núi lửa phun; Kokuō có cú húc hơi nước dài khoảng 860px và vòm nổ hơi; Saiken có bong bóng axit và sóng nhầy; Chōmei bổ nhào 3 lần và rải lân phấn lóa mắt; Gyūki có pháo mực dài khoảng 940px, 9 xúc tu nện và phân thân bạch tuộc. Hạ một Vĩ Thú được hồi 35% máu và +25 giáp.
- **Kẻ Thù Truyền Kiếp** (`sasuke-boss.js`, `tobi-boss.js`, `zetsu-boss.js`, `danzo-boss.js`, `ten-tails-boss.js`): năm trùm mới trong bảng tạo địch, mỗi trùm 8–9 chiêu riêng và một tuyệt chiêu. **Uchiha Sasuke**: Chidori Eisō, Amenotejikara, Amaterasu, Chidori Nagashi, Chidori Senbon, tiễn Susanoo, Viêm Độn Kagutsuchi, Kirin, tuyệt chiêu Mũi Tên Indra (tia dài 1.250px); bị dồn sát thương sẽ dựng xương sườn Susanoo. **Tobi**: Kamui hút vào, Mộc Độn, dịch chuyển Kamui ra sau lưng, Hào Hỏa Diệt Khước, Uchiha Gaeshi phản đòn, Thụ Giới Giáng Đản, xuyên thấu hư hoá, tuyệt chiêu triệu hồi Ngoại Đạo Ma Tượng. **Zetsu**: chui đất trồi lên dưới chân, Bào Tử Thuật, Mộc Độn gai, Hắc Zetsu ký sinh hút máu, gọi đại quân Bạch Zetsu, cây bắt mồi khổng lồ, lồng rễ cây, tuyệt chiêu Vạn Bào Phong Bạo. **Danzō**: Phong Độn Chân Không (liên ba, nhận, đại ngọc), triệu hồi Mạc (Baku) hút, Mộc Độn cánh tay, phục kích của Căn, tuyệt chiêu Lý Tứ Tượng Phong Ấn; **Izanagi** cho Danzō sống lại 3 lần (ở 66%, 40%, 18% máu). **Thập Vĩ**: con thú khổng lồ cao khoảng 470px, gầm chấn động, Vĩ Thú Ngọc, quét đuôi, mưa Vĩ Thú Ngọc nhỏ, rừng gai Mộc Độn, phân thân, thiên thạch lửa, tuyệt chiêu Siêu Cự Vĩ Thú Ngọc (nổ bán kính 720px); dưới 50% máu hoá Hoàn Thể, to và nhanh hơn. Thanh máu trùm của nhóm này ghi "KẺ THÙ TRUYỀN KIẾP"; Killer Bee ghi "ĐẠI CHIẾN NHẪN GIẢ".
- **Kage Đời Trước · Uế Thổ** (`edo-kage-bosses.js`, `edo-mizukage-bosses.js`): **Raikage đời 3** (Hắc Lôi, Địa Ngục Thích bốn ngón, giáp sét lao tới, Bất Hoại Chi Thân chỉ nhận 12% sát thương, tuyệt chiêu Nhất Bản Quán Thủ dài 1.250px); **Kazekage đời 3**, con rối người của Sasori (mưa cát sắt, cầu gai cát sắt, tay ẩn tẩm độc, lực từ hút, tuyệt chiêu Sa Thiết Giới Pháp bắn 18 gai tứ phía); **Rasa** (sóng cát vàng, giáo vàng, kim tự tháp phong ấn, khiên vàng, tuyệt chiêu sóng thần cát vàng); **Gengetsu** (Thủy Thiết Pháo, nắm đấm nước, Thủy Hóa né đòn, ảo ảnh con sò khổng lồ, quỷ hơi nước phát nổ, tuyệt chiêu Bách Quỷ: 7 quỷ hơi nước nổ dây chuyền); **Yagura** (gậy móc, gương nước tạo bản sao Naruto, san hô, rồng nước, lăn mai rùa, sương ảo giác, tuyệt chiêu hoá Tam Vĩ Isobu bắn Vĩ Thú Ngọc). Raikage và Rasa tự tái sinh một lần ở 40% máu.
- **Kage Đời Mới** (`new-kage-bosses.js`): **Darui** (Hắc Báo, tia Lam Độn quét, mưa sét đen, chém đại đao, nước nhiễm điện, tuyệt chiêu Laser Circus 14 tia bẻ cong); **Chōjūrō** (búa và kiếm chakra Hiramekarei, cá mập nước, thủy lao giam, chém ẩn trong sương, tuyệt chiêu song kiếm khai phóng); **Kurotsuchi** (vôi Dung Độn làm chậm chân, đạn vôi, người khổng lồ đá, gai đá, rồng đất, tuyệt chiêu lũ vôi rồi vòm đá úp xuống).
- **Gia Tộc Uchiha** (`uchiha-bosses.js`): **Shisui** (Thuấn Thân chém 5 lần, Hào Long Hỏa, phi tiêu bóng, hoá đàn quạ, Biệt Thiên Thần kéo bạn vào giữa trường Mangekyō, tuyệt chiêu Susanoo xanh); **Fugaku** (Hào Hỏa Cầu, Phượng Tiên Hỏa, lưới dây thép lửa của Cảnh Vụ Bộ, Amaterasu, nắm đấm Susanoo, tuyệt chiêu cầu lửa Susanoo); **Ōtsutsuki Indra** (Chidori lao tới, Yasaka, vòng lửa đen khép lại, cự kiếm Susanoo, Kirin, tuyệt chiêu Mũi Tên Indra dài 1.300px).
- **Pain Lục Đạo** (`pain-paths-bosses.js`): ngoài Thiên Đạo đã có thêm 5 thân. **Tu La Đạo** (tên lửa, pháo laser, nắm đấm tên lửa, lưỡi xoay, tuyệt chiêu laser đầu kèm mưa 26 tên lửa); **Nhân Gian Đạo** (rút hồn, mưa thanh nhận chakra, đọc tâm, tuyệt chiêu Vạn Hồn Trừu Xuất); **Súc Sinh Đạo** (chó ba đầu tách đôi, tê giác, chim khổng lồ, tắc kè hoa tàng hình, tuyệt chiêu Bách Thú Cuồng Bôn); **Ngạ Quỷ Đạo** (hút chakra hồi máu, phong ấn hấp thu, xoáy hút, tuyệt chiêu kết giới hấp thu che chắn cho cả đội); **Địa Ngục Đạo** (Diêm Vương thè lưỡi kéo, phán xử, hồi máu cho các thân khác và **hồi sinh** thân vừa chết, tuyệt chiêu Diêm Vương Đại Phệ). Các thân đứng gần nhau được nối bằng sợi chakra đen và hỗ trợ nhau.
- **Đối Thủ · Nhẫn Giả** (`duel-bosses.js`): **Hanzō Kỳ Nhông** (xích liềm, bom khí độc, triệu hồi kỳ nhông Ibuse phun độc, tuyệt chiêu cưỡi Ibuse tạo bão độc); **Might Guy** bản đối thủ (Mộc Diệp Cương Lực Toàn Phong, Dynamic Entry, Triêu Khổng Tước, Trú Hổ, Tịch Tượng, tuyệt chiêu Dạ Khải mở Tử Môn); **Rock Lee** (Toàn Phong, Biểu Liên, Túy Quyền, tháo tạ tăng tốc, Lý Liên, tuyệt chiêu Triêu Khổng Tước liên hoàn).
- **Cửu Vĩ Kurama** (`kyubi-boss.js`, trong nhóm Vĩ Thú): cáo chín đuôi khổng lồ cao ~500 px. Bạo Hống (sóng gầm), Vĩ Thú Ngọc, Bạo Trảo Xung Kích (lao càn rồi cào), Cuồng Vĩ Tảo (quét đuôi), Vĩ Thú Ngọc Liên Xạ, Chakra Cự Thủ (tay chakra tóm kéo), Xích Diễm Phún (phun lửa); tuyệt chiêu Cực Đại Vĩ Thú Ngọc san phẳng cả một khu.
- **Konoha · Thế Hệ Mới** (`konoha-rookie-bosses.js`, `konoha-eleven-bosses.js`): **Sakura** (Anh Hoa Xung, Thống Thiên Cước, Bách Hào hồi máu, triệu hồi Katsuyu, tuyệt chiêu Bách Hào Anh Hoa Đại Xung); **Hinata** (Bát Quái Lục Thập Tứ Chưởng, Song Sư Quyền, Hộ Thân 64 Chưởng, tuyệt chiêu hai sư tử chakra Hamura); **Neji** (Hồi Thiên, Không Chưởng, Không Bích Chưởng, tuyệt chiêu Bách Nhị Thập Bát Chưởng); **Shikamaru** (Ảnh Mô Phỏng giữ chân ngắn, Ảnh Thủ Phược, Ảnh Khâu, bẫy bộc phù, tuyệt chiêu Ảnh Mô Phỏng · Bộc Phù Đại Trận); **Chōji** (Nhục Đạn Chiến Xa, Bội Hóa, Tam Sắc Dược Hoàn, tuyệt chiêu cánh bướm Điệp Đạn Bạo Kích); **Ino** (Tâm Chuyển Thân kéo đối thủ, hoa bộc liên, Tâm Hoại, tuyệt chiêu Tâm Loạn Thân); **Kiba & Akamaru** (Thông Nha, Nha Thông Nha, tuyệt chiêu Song Đầu Lang); **Shino** (bầy trùng hút chakra, trùng phân thân, trùng trụ, tuyệt chiêu Trùng Cầu Đại Quyển); **Tenten** (Song Thăng Long, chùy xích, kunai bộc phù, quạt Ba Tiêu, tuyệt chiêu mưa 42 vũ khí).
- **Jōnin Làng Lá** (`konoha-jonin-bosses.js`): **Yamato** (Mộc Thích Trận, Tứ Trụ Lao, Tứ Trụ Gia, mộc phân thân, tuyệt chiêu Mộc Long); **Sai** (Mặc Sư, Mặc Điểu, Mặc Xà, cưỡi chim mực thả bom, tuyệt chiêu Bách Thú Cuồng Bôn); **Asuma** (Phi Yến, dao gió bay vòng, Hôi Tích Thiêu, Chân Không Nhận, tuyệt chiêu Phi Yến · Hôi Tích Bạo Viêm); **Kurenai** (mưa cánh hoa ảo thuật, Thụ Phược Sát, ảo ảnh phân thân, tuyệt chiêu Huyễn Hoa Thụ Giới).
- **Làng Cát · Làng Sương Mù** (`suna-kiri-bosses.js`): **Kankurō** (khôi lỗi Karasu, Kuroari, Sanshōuo, Xích Sa Hạt, tuyệt chiêu Thiết Nữ); **Temari** (Liêm Dứu, Đại Liêm Dứu, Kamatari, Trần Vân, tuyệt chiêu cơn lốc Thiết Thiết Vũ); **Zabuza** (Ẩn Vụ · Vô Thanh Sát Nhân, Thủy Long Đạn, Thủy Lao, thủy phân thân, ném đại đao, tuyệt chiêu Đại Bộc Bố); **Haku** (băng châm, Thiên Sát Thủy Tường, Yến Xuy Tuyết, tuyệt chiêu Ma Kính Băng Tinh).
- **Âm Nhẫn Ngũ** (`sound-bosses.js`): **Kimimaro** (Thi Cốt Mạch: Xuân Chi Vũ, Thập Chỉ Xuyên Đạn, Đường Tùng, Liễu, Thiết Tuyến Hoa, tuyệt chiêu rừng xương Tảo Quyết Chi Vũ); **Sakon & Ukon** (Đa Liên Quyền, Ukon ký sinh hút máu, La Sinh Môn, tuyệt chiêu Tam Trọng La Sinh Môn); **Tayuya** (Ma Địch, ba Nộ Quỷ, Thực Hồn Trùng, tuyệt chiêu Mộng Huyễn Âm Tỏa); **Kidōmaru** (lưới nhện, kim vàng, nhện khổng lồ, tuyệt chiêu Tri Chu Chiến Cung); **Jirōbō** (ném đá, La Hán Quyền, Thổ Lao Đường hút chakra). Tuyệt chiêu nào cũng bật chú ấn.
- **Đội Taka · Samurai** (`taka-bosses.js`): **Suigetsu** (Thủy Súng, Hào Thủy Oản, thủy hóa né đòn, Thủy Giao Đạn, tuyệt chiêu Thủy Quỷ Đại Trảm); **Jūgo** (tiên nhân hóa: cự chùy, phún xạ quyền, giáp chú ấn, tuyệt chiêu Phún Xạ Đại Bạo Phá); **Karin** (Kim Cương Phong Tỏa, Thần Lạc Tâm Nhãn, cắn hồi máu cho cả đội, tuyệt chiêu Kim Cương Phong Tỏa Trận); **Mifune** (Iai Nhất Thiểm, Phi Nguyệt Trảm, Thập Tự Trảm, thế phản kích, tuyệt chiêu Chân Không Thiên Trảm).
- **Nhân Trụ Lực** (`jinchuriki-bosses.js`): **Yugito** (Nhị Vĩ, lửa xanh), **Rōshi** (Tứ Vĩ, dung độn), **Han** (Ngũ Vĩ, bộc độn hơi nước), **Utakata** (Lục Vĩ, bong bóng), **Fū** (Thất Vĩ, cánh côn trùng, lân phấn). Mỗi người khoác áo chakra Vĩ Thú; tuyệt chiêu hóa hẳn thành Vĩ Thú rồi bắn Vĩ Thú Ngọc.
- **Lục Đạo · Khởi Nguyên** (`sage-bosses.js`): **Hagoromo** (Cầu Đạo Ngọc, Thần La Thiên Chinh, Âm Dương Độn, tuyệt chiêu Địa Bộc Thiên Tinh tạo mặt trăng đá); **Hamura** (Bát Quái Không Chưởng, Hồi Thiên, 64 Chưởng, tuyệt chiêu Kim Luân Chuyển Sinh Bạo); **Ashura** (Rasengan nguyên sơ, Thiên Thủ Quyền, Mộc Độn rễ cây, tuyệt chiêu pháp tướng A Tu La Thiên Thủ).
- **Thời Boruto · Kara** (`boruto-bosses.js`, `kara-bosses.js`): **Boruto** (Rasengan Tiêu Thất, Uzuhiko, phân thân, Karma, tuyệt chiêu Karma Đại Loa Toàn Hoàn); **Sarada** (Chidori, Shannarō, Hào Hỏa Cầu, tuyệt chiêu Sharingan liên kích); **Mitsuki** (tay rắn, Lôi Xà, Tiên Nhân Mô Thức, tuyệt chiêu Vạn Xà Triều); **Kawaki** (gai Karma, búa biến hình, Kāma hấp thu, tuyệt chiêu mưa khối Đại Hắc Thiên); **Jigen** (Thiếu Danh Mệnh, Đại Hắc Thiên, tuyệt chiêu khối lập phương khổng lồ); **Code** (Trảo Ngân, Bạch Quái, tuyệt chiêu Vạn Trảo Loạn Vũ); **Kashin Koji** (Viêm Đạn, Đại Ngọc Rasengan, cóc khổng lồ, tuyệt chiêu Cóc Du Viêm Đạn); **Urashiki** (cần câu hút chakra, đảo ngược thời gian, tuyệt chiêu Thuấn Ảnh Loạn Kích); **Toneri** (khôi lỗi, Cầu Đạo Ngọc, thiên thạch, Kim Luân, tuyệt chiêu Nguyệt Trảm Kiếm).
- Mọi nhân vật mới đều điều khiển được trong **Đấu Đội** (chuột trái tung lần lượt từng chiêu, tuyệt chiêu là chiêu cuối) và không đánh trúng đồng đội.
- Nhà có độ bền và sẽ sập khi trúng đủ đòn mạnh. Gạch ngói đổ lại thành phế tích, không còn cản đường. Tường thành, vách núi, hàng rào cây và cột đá của các làng (cùng tượng đá ở Konoha) cũng phá được: bền gấp khoảng 6 lần một ngôi nhà, sập xuống thành đống đất đá và mở lối đi. Riêng vách Đá Hokage phía bắc Konoha vẫn giữ nguyên; nhẫn thuật, đòn boss và vụ nổ tạo hố cháy, vết chém hoặc đường nứt tồn tại trên mặt đất. Chơi lại bằng `R` khôi phục bản đồ.
- HUD hiển thị số kẻ địch còn trên bản đồ, số ninja địch đã hạ, điểm, sinh lực hiện tại/tối đa, giáp, vũ khí và các phím nhẫn thuật.
- **Boss biết né** (mọi chế độ): boss và Vĩ Thú do máy điều khiển đọc trận đánh rồi lướt sang ngang để né khi phi tiêu, kunai, hỏa cầu, Rasen Shuriken hay Vĩ Thú Ngọc sắp bay trúng; lùi ra khi Naruto đang vung đòn hoặc gồng chiêu ngay sát bên; và né khi vừa trúng đòn nặng. Mỗi lần thấy nguy hiểm, boss có khoảng 70% cơ hội né; né xong phải chờ khoảng 1,3–2,4 giây mới né tiếp được, nên cứ dồn đòn liên tục là vẫn trúng. Trong Đấu Đội, boss còn né khi đối thủ gần đó đang ra chiêu nhắm vào nó.

## Nhẫn thuật

Các chiêu thông thường thi triển ngay, không có thời gian hồi chiêu và không cần tích chakra. Riêng Rasengan và Rasen Shuriken có thể giữ phím để tụ lực: càng giữ lâu, chiêu càng lớn và mạnh (đạt mức tối đa sau khoảng 2,4 giây); thả phím để xuất chiêu.

- `Q` — **Hỏa Độn:** chạm nhanh để bắn hỏa cầu gây sát thương diện rộng. Giữ `Q` để kết ấn tụ lửa trước miệng, thả ra để phun **Hào Hỏa Diệt Khước** (Gōka Mekkyaku) như Madara: một biển lửa hình quạt lan về hướng ngắm, cháy vài giây, đốt mọi kẻ địch bên trong và thiêu sập nhà cửa. Giữ càng lâu thì biển lửa càng xa, càng rộng và càng nóng (tối đa sau khoảng 2,4 giây).
- `E` — **Ảnh Phân Thân:** gọi 8 phân thân giống hệt bạn: cùng dạng (đang bật Baryon/Cửu Vĩ đỏ bằng `T` thì phân thân cũng hóa Baryon), cùng vũ khí đang cầm và cùng nhẫn thuật. Phân thân không hết hạn. Chúng tự lao vào kẻ địch gần nhất như Might Guy, đánh bằng trượng, song kiếm, phi tiêu hoặc kunai bùa nổ như bạn và thỉnh thoảng tung Hỏa Độn, Rasengan, Rasen Shuriken, Chidori (và Vĩ Thú Ngọc khi đang ở dạng Baryon). Khi không có địch, chúng chạy quanh bạn. Phân thân chỉ có 30% máu tối đa của bạn, và kẻ địch cũng nhắm đánh chúng; phân thân hết máu sẽ "bùm" thành khói rồi biến mất. Nhấn `E` lần nữa để thu hồi.
- `C` — **Triệu Hồi:** gọi Thập Vĩ hộ vệ chiến đấu trong khoảng 15 giây; tối đa một Thập Vĩ cùng lúc để giữ game mượt.
- `V` — **Might Guy · Tử Môn:** nhấn để triệu hồi Might Guy ở trạng thái Bát Môn mạnh nhất. Anh lao nhanh đánh cận chiến theo chuỗi combo: cú thứ 4 là Asa Kujaku (Triêu Khổng Tước, đuôi công lửa và mưa nắm đấm lửa hình nón), cú thứ 7 là Sekizō (Tịch Tượng, năm phát đạn khí nện xuống đất), cú thứ 10 là Hirudora (Trú Hổ, hổ khí khổng lồ lao thẳng rồi nổ tung). Cứ khoảng 15 giây anh lại tung Night Guy (Dạ Khải) với rồng hơi đỏ. Anh ở lại không giới hạn thời gian; nhấn `V` lần nữa để thu hồi.
- `H` — **Triệu hồi bốn Hokage:** nhấn để gọi đồng thời Đệ Nhất Hashirama (Mộc Độn), Đệ Nhị Tobirama (Thủy Độn), Đệ Tam Hiruzen (Hỏa Độn) và Đệ Tứ Minato (Phi Lôi Thần/Rasengan). Cứ mỗi đòn thứ 5, mỗi Hokage tung tuyệt kỹ: Hashirama gọi Thụ Giới Giáng Đản (cả khu rừng trồi lên) cùng Mộc Long, Tobirama phóng Thủy Long Đạn rồi dựng tường nước đổ sập, Hiruzen phun Hỏa Long Viêm Đạn (bình thường là Hỏa Cầu lớn), Minato dùng Phi Lôi Thần nhảy chớp qua tối đa 5 kẻ địch rồi kết thúc bằng Rasengan lớn. Vừa xuất hiện, Hiruzen triệu hồi **Viên Hầu Vương Enma** rồi Enma hóa thành **Kim Cương Như Ý** (gậy Kongōnyoi) trong tay ông: đòn thứ 2 của mỗi chuỗi 5 đòn, gậy vươn dài đâm xuyên một hàng địch; đòn thứ 4 là **Kim Cương Lao Bích**, một vòng gậy cắm xuống nhốt và trói địch bên trong. Cả đội ở lại không giới hạn thời gian; nhấn `H` lần nữa để thu hồi.
- `F` — **Chidori:** lướt nhanh với sét đánh trên đường đi.
- `Space` — **Rasengan:** giữ để tụ quả cầu chakra lớn hơn, thả để đánh quanh nhân vật.
- `X` — **Rasen Shuriken:** giữ để tụ phi tiêu chakra lớn hơn, thả để phóng theo hướng ngắm.
- `Chuột phải` — **Chidori tím:** giữ để tụ lôi tím, thả để lướt theo hướng ngắm. Giữ càng lâu thì lướt càng xa, vùng lôi khi đáp xuống càng rộng và sát thương chí mạng càng mạnh (tối đa sau khoảng 2,4 giây). Bấm nhanh vẫn lướt ngay; dùng được cả khi chưa biến hình và mạnh hơn trong dạng Baryon.

## Biến hình Baryon / Cửu Vĩ đỏ

Trong lúc chơi, nhấn `T` để bật hoặc tắt dạng Baryon/Cửu Vĩ đỏ mạnh nhất, không có thời gian hồi chiêu. Nhân vật được bao phủ bởi luồng chakra đỏ thẫm với chín đuôi; vũ khí đang cầm được giữ nguyên, không tự rút song kiếm Susanoo. Sinh lực tối đa tăng **100 lần** (100 thành 10.000) và sinh lực hiện tại cũng nhân 100; khi tắt, sinh lực được chia lại theo cùng tỷ lệ. Dạng này còn di chuyển nhanh gấp **1,7 lần**, gây sát thương gấp **2,4 lần** bằng mọi đòn đánh và nhẫn thuật, giảm **35%** khoảng nghỉ giữa các đòn, đồng thời hồi **2%** sinh lực tối đa mỗi giây.

Khi đang ở dạng Baryon, chuột trái không dùng vũ khí mà đánh bằng chakra Cửu Lạt Ma theo chu kỳ 6 lần bấm (sát thương bên dưới còn được nhân 2,4):

- Lần 1, 3, 5: **Quyền Chakra**: nắm đấm chakra đỏ cam phóng xa 260 theo hướng ngắm, kèm vệt lửa và vòng lửa nơi trúng (300 sát thương).
- Lần 2, 4: **Cửu Vĩ Quất**: chín đuôi chakra quất ra thành hình quạt rộng phía trước, xa 300 (260 sát thương, đẩy lùi).
- Lần 6: **Cự Thủ Cửu Lạt Ma** (九喇嘛の腕): bàn tay chakra khổng lồ có móng vuốt từ trên trời đập xuống điểm ngắm (xa tới 620), nổ lửa bán kính 240 (1.000 sát thương).

**Chế độ nào bật sau cùng sẽ giữ chuột trái** (T, Y hoặc U). Tắt chế độ đó thì chuột trái chuyển về chế độ còn lại; tắt hết thì dùng vũ khí như bình thường.

Chỉ khi đang ở dạng Cửu Vĩ đỏ, nhấn `G` để bắn **Vĩ Thú Ngọc** gây sát thương diện rộng. Giữ `G` để tụ lực như Rasengan: chakra đen trắng hút về thành quả cầu ngày càng lớn trước mặt Naruto, mặt đất nứt và bụi bị kéo vào; thả ra để bắn. Tụ đầy (khoảng 2,4 giây) thì quả cầu to gấp 2,6 lần, nổ rộng gấp 2,5 lần, sát thương gấp khoảng 3,5 lần. Chiêu này không có hồi chiêu; ô kỹ năng `G` chỉ hiện khi biến hình.

## Bát Môn Độn Giáp (như Might Guy)

Nhấn `Y` để mở hoặc đóng Bát Môn Độn Giáp. Naruto bốc hơi máu đỏ như Might Guy, chạy nhanh gấp **1,85 lần** và để lại tàn ảnh. Lúc mở cổng có cú nổ chấn động. Khi đang mở, chuột trái không dùng vũ khí mà đi theo **chuỗi 12 đòn** (giữ chuột để đánh liên tục, hết chuỗi thì lặp lại):

1. Đấm thường
2. **Mộc Diệp Đại Toàn Phong** (Konoha Daisenpū): đá xoay tạo lốc lá cây bán kính khoảng 520px, hút địch vào trong 3 nhịp rồi hất văng ra ngoài
3. Đấm thường
4. **Triêu Khổng Tước**: đuôi công lửa và mưa nắm đấm lửa hình nón
5. **Phi Cước** (Dynamic Entry): bay đá tới chỗ con trỏ (xa tối đa khoảng 760px), đáp xuống thành hố lửa bán kính khoảng 420px; bất tử khi đang bay
6. Đấm thường
7. **Tịch Tượng**: 6 cột khí nện xuống theo hàng
8. **Liên Hoa Ngược** (Ura Renge): lướt chớp nhoáng qua tối đa 12 kẻ địch liền nhau, đánh từng tên, kết thúc bằng một đóa sen chakra đỏ nở tung bán kính khoảng 480px
9. Đấm thường
10. **Trú Hổ**: hổ khí lao thẳng rồi nổ tung
11. **Tịch Tượng Loạn Vũ**: 17 cột khí giáng xuống thành ba vòng quanh con trỏ (vòng ngoài rộng khoảng 470px)
12. **Dạ Khải** (Night Guy): rồng hơi đỏ lao thẳng khoảng 1.050px phá cả nhà cửa trên đường, vụ nổ cuối bán kính khoảng 620px

Mỗi cú đấm thường tung một luồng áp lực không khí quét mặt đất xa khoảng 300px theo hình quạt. Khổng Tước, Tịch Tượng và Trú Hổ có tầm và vùng ảnh hưởng **rộng gấp 1,8 lần** của Might Guy đồng minh. Sinh lực tối đa tăng **30 lần** (100 thành 3.000), sinh lực hiện tại nhân theo; khi đóng cổng, sinh lực được chia lại theo cùng tỷ lệ. Đang mở cổng thì tự hồi **3%** sinh lực tối đa mỗi giây. Bị hạ gục thì cổng tự đóng. Có thể bật cùng Baryon: máu tối đa nhân dồn (100 × 30 = 300.000), tốc độ, sát thương và hồi máu cũng cộng dồn.

## Luân Hồi Nhãn (Rinnegan)

Nhấn `U` để bật hoặc tắt Rinnegan. Mắt Naruto chuyển sang Luân Hồi Nhãn tím có các vòng gợn, quanh chân có sóng tím lan ra. Lúc bật có hình con mắt khổng lồ in lên mặt đất. Sinh lực tối đa tăng **20 lần** (nhân dồn với Baryon và Bát Môn), tự hồi **2%** mỗi giây. **Ngạ Quỷ Đạo:** đòn ném và chiêu bắn của địch bay tới gần Naruto bị hút vào và hồi 1,5% máu tối đa. Khi đang bật, chuột trái thay vũ khí bằng Thiên Đạo theo chu kỳ 6 lần bấm:

- Lần 1, 3, 5: **Thần La Thiên Chinh** (神羅天征): quả cầu lực đẩy bán kính 320 hất văng mọi kẻ địch quanh Naruto (420 sát thương) và quét sạch đòn bắn của địch.
- Lần 2, 4: **Vạn Tượng Thiên Dẫn**: kéo mọi kẻ địch quanh điểm ngắm (xa tới 620) bay thẳng về trước mặt Naruto (300 sát thương).
- Lần 6: **Địa Bộc Thiên Tinh** (地爆天星): lõi đen bay lên trên điểm ngắm, hút kẻ địch trong bán kính 300 và nhấc đá từ mặt đất thành một quả cầu đá ngày càng lớn trong khoảng 3 giây, rồi ép nát (1.800 sát thương).

Nếu bật nhiều chế độ, chế độ bật sau cùng giữ chuột trái; các chế độ khác vẫn giữ máu và tốc độ. Bị hạ gục thì Rinnegan tự tắt.

## Lục Đạo Tiên Nhân (六道仙人モード)

Nhấn `I` để bật hoặc tắt (`six-paths-mode.js`). Naruto khoác áo choàng chakra vàng có vòng câu ngọc đen ở cổ, bay lơ lửng như Lục Đạo Madara, sau lưng là vòng **9 Cầu Đạo Ngọc**. Lúc bật có ấn Lục Đạo in xuống đất, cột chakra vàng và sóng chấn động. Sinh lực tối đa **10.000** (×100, nhân dồn với các chế độ khác), tự hồi **2,5%** mỗi giây, chạy nhanh **2,3 lần**. Cầu Đạo Ngọc tự chặn mọi đòn bắn của địch bay tới gần. Khi đang bật, chuột trái đi theo **chuỗi 12 bước** (giữ chuột để đánh liên tục):

- **Cầu Đạo Ngọc · Phi Đạn:** 5–7 quả cầu đen bay vòng tới điểm ngắm (xa tới 900) rồi nổ.
- **Lục Đạo Tích Trượng:** gậy đen thành hình, quét 223° bán kính 330 rồi đâm thẳng 580.
- **Cầu Đạo Ngọc · Hắc Bổng Vũ:** 22 thanh gậy đen rơi xuống vùng ngắm rồi cùng nổ thành vòm đen.
- **Luân Mộ · Biên Ngục:** bóng vô hình chém 4 lần vào tối đa 10 kẻ địch trong vùng bán kính 330.
- **Tiên Pháp · Loa Toàn Thủ Lý Kiếm:** Rasenshuriken có Cầu Đạo Ngọc bay quanh, nở thành mái vòm gió bán kính 300 hút địch vào.
- **Cầu Đạo Ngọc · Hắc Thuẫn Ba:** sóng đen viền vàng lan ra 560, hất văng địch và xoá đòn bắn.
- Bước 12, chiêu cuối **Lục Đạo · Thiên Ải Chấn Tinh:** ba thiên thạch rơi quanh điểm ngắm, mỗi quả nổ bán kính 250 (7000 sát thương), để lại hố lửa.

## Susanoo (須佐能乎)

Nhấn `O` để bật hoặc tắt (`susanoo-mode.js`). Lửa chakra tím bùng lên, khung xương sườn dựng lên trước rồi đến giáp: một Susanoo tím cao gấp khoảng 4 lần Naruto, có mũ sừng mũi tengu, mắt phát sáng, hai cánh tay giáp lớn, và Naruto vẫn đứng ở giữa. Lúc hình thành có sóng xung kích hất văng địch và xoá đòn bắn. Sinh lực tối đa ×40, tự hồi 2% mỗi giây, mọi đòn trúng chỉ còn **35%** sát thương. Khi đang bật, chuột trái đi theo **chuỗi 10 bước** (giữ chuột để đánh liên tục):

- **Kiếm Trảm:** chém kiếm hình quạt 470.
- **Susanoo Tiễn:** mũi tên xuyên thẳng 1100.
- **Thiết Quyền:** nắm đấm khổng lồ nện xuống tạo hố.
- **Viêm Độn · Kagutsuchi Kiếm:** sóng lửa đen 880, đường đi cháy tiếp vài giây.
- **Liên Xạ Tiễn:** 7 mũi tên hình quạt.
- **Amaterasu · Hắc Viêm Tường:** tường lửa đen dài 780, chặn đòn bắn.
- **Lôi Độn · Thiên Điểu Tiễn:** mũi tên bọc sét, nổ Chidori rồi sét lan sang 5 kẻ địch.
- **Kagutsuchi Câu Ngọc:** 3 câu ngọc lửa đen, nổ thành vòm lửa.
- Bước 10, chiêu cuối **Viêm Độn · Susanoo Kagutsuchi:** Susanoo dang cánh, bắn mũi tên lửa đen khổng lồ dài 1200 (8200 sát thương, nổ cuối đường bán kính 360), để lại lửa đen cháy khoảng 4 giây.

## Sasuke · Indra (因陀羅)

Nhấn `B` để gọi Sasuke (Indra chuyển sinh, `sasuke-indra.js`), nhấn lại để thu hồi. Sasuke mắt trái Luân Hồi Nhãn, mắt phải Vĩnh Hằng Vạn Hoa Đồng, áo choàng xám và kiếm Kusanagi. Anh đi theo Naruto, ưu tiên đánh boss và Vĩ Thú trong tầm 900, xen giữa các chiêu là đường chém Kusanagi:

- **Chidori Eisō · Lôi Thương:** ngọn giáo sét đâm thẳng 700.
- **Amenotejikara:** đổi chỗ tức thì ra cạnh kẻ địch xa tới 900 rồi chém một nhát lớn.
- **Amaterasu:** lửa đen bùng lên vùng bán kính 260 và cháy khoảng 6 giây.
- **Susanoo · Tiễn:** Susanoo có cánh giương cung bắn 7 mũi tên hình quạt xa 1000.
- **Chidori Nagashi:** vòng sét tím phóng ra quanh người bán kính 300.
- **Kirin:** mây giông kéo tới rồi rồng sét lao xuống, nổ bán kính 450.
- **Viêm Độn · Kagutsuchi:** 5 lưỡi lửa đen phóng ra hình quạt.
- Chiêu cuối **Indra Tiễn:** Susanoo Hoàn Thể màu tím mọc lên, giương cung bắn tia sét dài 1200, rộng 160 (8200 sát thương), xẻ đất suốt đường bay. Lần đầu sau khi gọi khoảng 8 giây, sau đó cứ khoảng 17–19 giây một lần.

## Đại Chiến Ninja lần thứ tư (第四次忍界大戦)

Trong bảng **TẠO ĐỊCH** (phím `N`) có công tắc **ĐẠI CHIẾN NINJA LẦN THỨ TƯ**. Bật lên rồi bấm TẠO ĐỊCH để vào chiến trường phía nam đường Cát–Sương Mù: đồng bằng đất nứt, hố thiên thạch, vũ khí gãy và cờ 忍 của Liên Quân Nhẫn Giả, khói lửa bốc lên khắp nơi. Chế độ này hiện chỉ chơi đơn.

- **Phe ta:** Ngũ Kage (Tsunade, Gaara, Mei, Raikage A, Ōnoki), Tứ Đại Hokage và khoảng 80 ninja Liên Quân của năm làng. Ai cũng chiến đấu bằng chiêu riêng như trong phim. Khắp đồng bằng còn hàng trăm toán ninja và Bạch Zetsu đang giáp lá cà.
- **Mộc Độn của Đệ Nhất:** đòn thường của Hashirama đánh trúng cả một vùng rộng. Cứ khoảng 13 giây ông lại tung **Thụ Giới Giáng Đản**: một khu rừng mọc tràn ra quanh ông, bán kính hơn một màn hình, đánh và trói mọi kẻ địch trong tầm.
- **Giai đoạn 1:** Madara Uchiha (Uế Thổ Chuyển Sinh) cùng khoảng 170 Bạch Zetsu liên tục kéo tới từ phía bắc. Madara rất trâu: chịu ít sát thương, thân Uế Thổ tự liền lại, ra chiêu dồn dập (nhanh hơn nữa khi còn dưới nửa máu), và chiêu của hắn hất tung ninja Liên Quân.
- **Hồi sinh:** hạ Madara thì hắn hồi sinh, phong ấn Thập Vĩ vào người. Bầu trời tối sầm lại.
- **Giai đoạn 2:** Lục Đạo Madara bay lơ lửng với Cầu Cầu Đạo. Might Guy mở Bát Môn đến trợ chiến.
- **Chiến thắng:** hạ Lục Đạo Madara là Liên Quân thắng trận và bạn được hồi đầy máu.

Tắt công tắc để kết thúc đại chiến.

## Đấu Đội

Ở màn hình đầu, bấm **ĐẤU ĐỘI** (cạnh **BẢO VỆ LÀNG NINJA**) để mở màn tạo đội. Muốn chơi Đấu Đội cùng bạn bè, xem phần **Đấu Đội co-op** ở mục Co-op.

**Tạo đội**

- **SỐ ĐỘI**: bấm `−` / `+` để chọn từ 2 đến 10 đội. Mỗi đội có một màu riêng. Bấm vào ô tên để đổi tên đội (mặc định là ĐỘI 1, ĐỘI 2…).
- Bấm vào một đội để chọn đội đó, rồi bấm nhân vật ở danh sách bên cạnh để thêm vào đội. Mỗi đội thêm bao nhiêu nhân vật cũng được (đông quá thì máy chạy chậm); trong trận, bảng THÊM QUÂN (phím N) thêm tối đa 50 nhân vật mỗi lần bấm. Danh sách gồm Naruto, mọi boss trong bảng TẠO ĐỊCH (Kage, Akatsuki, Sannin, Hokage, Uchiha, Pain Lục Đạo, Ōtsutsuki…), ninja thường, ninja các làng, Bạch Zetsu và tám Vĩ Thú. Bấm vào một nhân vật trong đội để bỏ nhân vật đó ra.
- **Điểm xuất phát**: bấm lên bản đồ thế giới để cắm cờ cho đội đang chọn. Nút **CHIẾN TRƯỜNG** rải cờ quanh đồng bằng Đại Chiến; nút **LÀNG LÁ** rải cờ quanh Làng Lá.
- **Cách chơi**: chọn **ĐIỀU KHIỂN NHÂN VẬT** để vào trận và điều khiển một nhân vật, hoặc **CHỈ XEM** để chỉ ngồi xem các đội đánh nhau. Ở chế độ chỉ xem, bạn không điều khiển ai; nếu có chọn Naruto thì máy điều khiển Naruto.
- Bấm **BẮT ĐẦU**. Lần tạo đội gần nhất được lưu lại trên máy, lần sau mở ra vẫn còn nguyên.

**Trong trận**

- **Cân bằng kiểu Liên Minh Huyền Thoại**: mọi nhân vật có tên (boss, Vĩ Thú, Naruto; không tính ninja thường) có cùng lượng máu gốc 40.000 và gây sát thương mỗi giây xấp xỉ nhau, nên thắng thua nằm ở việc ra chiêu trúng, né và lướt cho khéo chứ không ở chỉ số. Hệ số riêng của từng nhân vật được đo bằng máy: sát thương mỗi giây lên hình nộm, và lượng sát thương nhận vào từ cùng một đối thủ (né giỏi, hay đỡ đòn hay to xác thì máu ít hoặc nhiều hơn một chút).
  - **Hồi máu bị cắt mạnh**: mọi kiểu hồi máu (chiêu tự hồi, hồi máu đồng đội, tự hồi theo thời gian, chiêu hút/hoàn lại sát thương) chỉ còn 35% lượng hồi, tối đa 12% máu trong một lần, rồi nạp lại 2% mỗi giây.
  - Giáp riêng của từng boss không còn tác dụng; khiên hay thế thủ chỉ chặn tối đa 55% một đòn (các chiêu bất tử chớp nhoáng như Izanagi vẫn giữ).
  - Các mode của Naruto (`T`, `Y`, `U`, `I`, `O`) không tăng máu tối đa nữa, chỉ đổi bộ chiêu và chạy nhanh hơn khoảng 15%; Susanoo chỉ giảm 30% sát thương. Triệu hồi (`C`, `V`, `B`, `H`, `Z`) và Ảnh Phân Thân (`E`) tắt trong Đấu Đội, vì một Sasuke hay Might Guy triệu hồi gây sát thương gấp 2–3 lần cả một nhân vật.
- **Khống chế**: mỗi nhân vật có 1–3 chiêu khống chế đúng chất của mình (ví dụ Ảnh Mô Phỏng của Shikamaru, Sa Phược Cữu của Gaara, Nguyệt Đọc của Itachi, Thủy Lao của Kisame/Zabuza, Tri Chu Phược của Kidōmaru, Mộc Độn của Hashirama/Madara, Địa Bộc Thiên Tinh của Pain). Trong lúc chiêu đó đang ra (khoảng 2,6 giây kể từ lúc niệm), mọi đòn trúng của nó, kể cả đạn bay, gây hiệu ứng:
  - **Choáng** (0,7–1,5 giây): không đi, không ra chiêu, không lướt, và **chiêu đang niệm bị cắt ngang**. Trên đầu có vòng sao vàng xoay và chữ CHOÁNG kèm thời gian còn lại.
  - **Trói** (1,2–1,6 giây): đứng yên tại chỗ, không lướt được nhưng vẫn ra chiêu. Dưới chân có vòng bóng tím và các sợi trói quấn lên người.
  - **Làm chậm** (2–2,5 giây): chạy chậm còn 55%. Dưới chân có các vòng sóng xanh lan ra.
  - Lúc dính khống chế, chữ CHOÁNG / TRÓI / CHẬM bật lên trên đầu. Vĩ Thú và nhân vật khổng lồ chỉ bị giữ 60% thời gian. Hết choáng hoặc trói thì có 1,2 giây không bị choáng/trói tiếp, để không bị khoá liên tục. Naruto cũng bị khống chế như mọi người; Chidori (`F`) của Naruto gây choáng 0,6 giây, Rasen Shuriken làm chậm.
- Mọi nhân vật chạy cùng một tốc độ, nhanh hơn trước: khoảng 340 px/giây (trước đây boss khoảng 200, Naruto khoảng 270); Vĩ Thú và nhân vật khổng lồ 300 px/giây (trước đây khoảng 90). Ai cũng biết **lướt** (thuấn thân): một cú lao ngắn để lại bóng mờ và bụi, không xuyên qua nhà hay tường, **hồi chiêu 3 giây** cho mọi nhân vật, cả người chơi lẫn máy. Máy tự lướt để áp sát đối thủ ở xa, và lướt né sang ngang khi đứng trong vùng cảnh báo nhẫn thuật, khi đối thủ gần đó đang ra chiêu nhắm vào nó, hoặc vừa trúng đòn nặng.
- **Máy đánh như người chơi thật**: mỗi nhân vật máy có tính cách riêng (thích đánh gần hay giữ khoảng cách, hung hăng nhiều hay ít). Chúng đi vòng quanh đối thủ, bất chợt đổi hướng như đang lừa né, lao vào ra đòn rồi lùi ra, giãn khỏi đồng đội thay vì dồn một chỗ, và khi máu dưới khoảng 28% mà đang thua thì lướt lùi về một lúc rồi quay lại. Khi chọn mục tiêu, chúng ưu tiên kẻ yếu máu, kẻ đang đứng ra chiêu và nhân vật bạn đang điều khiển, và không đổi mục tiêu lung tung. Máy né trong Đấu Đội nhạy hơn (khoảng 82%), nhưng né cũng là lướt nên dùng chung hồi chiêu 3 giây; cả nhân vật thường cũng biết né, và chúng lướt áp sát kẻ đang kẹt trong chiêu.
- **Tự tìm đường giữa các làng**: các đội xuất phát ở những làng khác nhau sẽ tự chạy và lướt (mỗi 3 giây) để đi tìm nhau, tự vòng qua nhà cửa và vách núi, còn nếu tường làng hay nhà chắn đường quá lâu thì đập vỡ luôn để đi tiếp (thử nghiệm: hai góc bản đồ cách nhau khoảng 23.000 px gặp nhau sau khoảng 30 giây).
- **Bảng kết quả** khi trận kết thúc liệt kê từng đội với avatar và tên mọi nhân vật: ai còn sống (kèm thanh máu, nhân vật bạn điều khiển ghi "BẠN") và ai đã gục (ảnh xám, gạch tên). Đội thắng được tô sáng; người chơi co-op cũng thấy đúng bảng này.
- Mỗi nhân vật đứng trên một vòng màu của đội mình, có thanh máu cùng màu. Các nhân vật tự rời điểm xuất phát, đi tìm đội khác gần nhất và đánh nhau. Đòn của một đội không trúng người cùng đội.
- Naruto đầu tiên được chọn (ở bất kỳ đội nào) là bạn, với đầy đủ phím và nhẫn thuật như chế độ thường, máu gốc 40.000. Những Naruto chọn thêm là Naruto do máy điều khiển. Nếu không chọn Naruto nào, bạn chỉ đứng xem và điều khiển các nhân vật khác.
- **Điều khiển bất kỳ ai**: `Tab` / `Shift+Tab` chuyển sang nhân vật kế tiếp / trước đó (mọi đội). Khi đang chỉ xem, chuột phải vào một nhân vật; hoặc bấm ảnh của nhân vật trong bảng đội ở góc phải, hoặc bấm vào nhân vật trên bản đồ lớn (`M`) để điều khiển nhân vật đó. Camera đi theo nhân vật bạn đang điều khiển. Nhân vật đó có vòng trắng nhấp nháy và mũi tên trên đầu.
- **Chuột phải** để lướt về phía con trỏ, **hồi chiêu 3 giây** (ô LƯỚT ở thanh chiêu hiện thời gian hồi). Giữ chuột phải thì lướt ngay khi hồi xong. Lướt được cả khi nhân vật đang dở chiêu. Dùng được cho mọi nhân vật, kể cả Naruto. Trong Đấu Đội, `Shift` không còn dùng để lướt hay chạy nhanh, và chuột phải của Naruto là lướt thay cho Chidori tím.
- Khi điều khiển boss, Vĩ Thú hay ninja: `W A S D` để đi, **chuột trái tung chiêu liên hoàn** về phía con trỏ, giống chế độ Lục Đạo (`I`) của Naruto: mỗi lần bấm (hoặc giữ chuột) là tung chiêu kế tiếp theo thứ tự 1 → 2 → 3 → … rồi quay vòng lại. Chiêu nào đang hồi thì bỏ qua, nếu không chiêu nào sẵn sàng thì đánh thường. Mỗi chiêu hồi 1,5 giây; chiêu cuối (tuyệt chiêu) hồi 12 giây. Thanh chiêu ở dưới màn hình hiện tên chiêu, thời gian hồi, và viền sáng ở chiêu sẽ ra tiếp theo. Không cần bấm phím số nữa. Ninja thường dùng các nhẫn thuật riêng của mình.
- **Chỉ xem**: `W A S D` hoặc phím mũi tên để di chuyển camera (giữ `Shift` để nhanh hơn), kéo chuột trái để kéo camera, bấm vào bản đồ nhỏ hoặc bản đồ lớn (`M`) để đưa camera tới đó, `F` để bật/tắt camera tự theo trận đánh lớn nhất. Bấm `Tab` hoặc chuột phải vào một nhân vật để nhập vai bất cứ lúc nào (lúc đang điều khiển thì chuột phải là lướt, đổi nhân vật bằng `Tab` hoặc bảng đội). Đang điều khiển ai đó thì bấm `Backspace` để thả ra và chuyển sang chỉ xem (cũng dùng được khi đã chọn ĐIỀU KHIỂN NHÂN VẬT).
- Khi bạn điều khiển nhân vật khác (hoặc đang chỉ xem), máy tự điều khiển Naruto: lao vào địch gần nhất, đánh bằng trượng, tung Rasengan, Rasen Shuriken và hỏa cầu.
- Trong Đấu Đội, Naruto **không dùng được Ảnh Phân Thân (`E`) và các triệu hồi (`C`, `V`, `B`, `H`, `Z`)**. Mọi mode của Naruto (`T`, `Y`, `U`, `I`, `O`) giữ nguyên máu 40.000, chỉ tự hồi rất chậm và không cộng dồn khi bật nhiều mode; sát thương của Baryon được giảm để ngang các mode khác.
- Nhân vật đang điều khiển bị hạ thì bạn chuyển sang một nhân vật còn sống của cùng đội (hết thì sang đội khác).
- Bảng đội ở góc phải hiện số nhân vật còn lại và số lần hạ gục của từng đội. Bấm **CÁC ĐỘI** để thu gọn bảng.
- `N` (hoặc nút **THÊM QUÂN**) mở bảng thêm quân giữa trận: chọn đội, số lượng (1–50) và nơi xuất hiện (cờ của đội hoặc một điểm bấm trên bản đồ), rồi bấm nhân vật để thêm ngay.
- Trong Đấu Đội không có báo động làng và không có đợt địch.
- Khi chỉ còn một đội có người đứng, màn kết quả hiện đội thắng và số lần hạ gục của từng đội. Bấm **CHƠI LẠI** để đánh lại với đội vừa tạo, **VỀ MÀN TẠO ĐỘI** để sửa đội, hoặc **MÀN HÌNH CHÍNH**. Phím `R` trong trận đưa bạn về màn hình chính.

## Điều khiển

- Con trỏ chuột là tâm ngắm to có viền đen, đổi màu theo vũ khí/chế độ (trắng khi đang bấm giữ chuột trái).

- `W A S D`: di chuyển
- `Shift`: chạy nhanh
- Chuột: ngắm; nhấn hoặc giữ chuột trái để tấn công bằng vũ khí đang cầm
- Chuột phải: giữ tụ Chidori tím, thả để lướt xa và tung lôi tím diện rộng chí mạng
- `1`: rút Trượng Lục Đạo
- `2`: rút **phi tiêu**: giữ chuột trái để ném liên tục, mỗi phi tiêu xuyên qua 2 kẻ địch; ở dạng Baryon mỗi lần ném 3 phi tiêu hình quạt
- `3`: rút song kiếm Susanoo
- `4`: rút **kunai bùa nổ**: kunai cắm vào kẻ địch (hoặc chỗ nó rơi xuống), bùa nổ cháy xèo xèo khoảng nửa giây rồi nổ, gây sát thương diện rộng và phá nhà
- `T`: bật / tắt Baryon/Cửu Vĩ đỏ; giữ nguyên vũ khí đang cầm
- `Y`: mở / đóng Bát Môn Độn Giáp; chuột trái thành chuỗi 12 đòn thể thuật của Might Guy
- `U`: bật / tắt Luân Hồi Nhãn; chuột trái thành Thần La Thiên Chinh / Vạn Tượng Thiên Dẫn / Địa Bộc Thiên Tinh
- `I`: bật / tắt Lục Đạo Tiên Nhân; chuột trái thành chuỗi nhẫn thuật Lục Đạo
- `O`: bật / tắt Susanoo (như Sasuke); chuột trái thành chuỗi nhẫn thuật Susanoo
- `Z`: 100 phân thân Naruto mode Cửu Vĩ, mỗi phân thân cầm một Rasengan khổng lồ lao vào đánh địch (`kurama-clones.js`), có thời gian hồi
- `E`: gọi / thu hồi 8 Ảnh Phân Thân
- `C`: triệu hồi Thập Vĩ
- `V`: bật/tắt Might Guy ở trạng thái Bát Môn mạnh nhất
- `B`: bật/tắt triệu hồi Sasuke (Indra chuyển sinh)
- `H`: bật/tắt đội Hokage Đệ Nhất, Nhị, Tam, Tứ
- `G`: Vĩ Thú Ngọc khi đang ở dạng Cửu Vĩ đỏ (giữ để tụ lực, thả để bắn)
- `Space`: giữ tụ Rasengan, thả để đánh
- `X`: giữ tụ Rasen Shuriken, thả để phóng
- `N`: mở bảng tạo kẻ địch (Đấu Đội: thêm quân)
- `Tab` / `Shift+Tab` (Đấu Đội): đổi nhân vật đang điều khiển; khi chỉ xem, chuột phải vào một nhân vật để điều khiển nhân vật đó
- Chuột trái (Đấu Đội, khi điều khiển boss, Vĩ Thú hay ninja): tung lần lượt từng chiêu về phía con trỏ, như chế độ Lục Đạo
- Chuột phải (Đấu Đội): lướt về phía con trỏ, không hồi chiêu, giữ để lướt liên tục · `Backspace`: thả nhân vật, chuyển sang chỉ xem · `F` (khi chỉ xem): camera tự theo trận đánh
- `M`: mở bản đồ lớn của thế giới; bấm vào bản đồ để dịch chuyển
- `P`: bật / tắt đồ hoạ WebGL (phát sáng, sóng xung kích)
- `L`: đổi **kiểu đồ hoạ (bản thử)**, lần lượt: Gốc → Pixel art → Anime. Lựa chọn được nhớ cho lần sau.
  - **Pixel art**: Naruto, Sasuke, Rasengan và Chidori được vẽ lại trên lưới pixel; nhân vật và chiêu khác giữ kiểu vẽ cũ.
  - **Anime**: Rasengan, Rasen Shuriken, Chidori và Vĩ Thú Ngọc vẽ kiểu cel anime (mảng màu phẳng, viền mực, nét cọ thuôn nhọn, ngôi sao xung kích). Thêm "cảm giác đòn" cho mọi chiêu: đòn nặng làm cả thế giới khựng lại 50–90 ms, đòn rất mạnh có 2 khung hình đảo màu (tối đa 3 giây một lần) và đường tốc độ dồn vào giữa màn hình. Không áp dụng trong co-op và khi đang chỉ xem Đấu Đội. Kiểu Anime vẽ nặng hơn: trận đông người (khoảng 32 nhân vật) tụt từ khoảng 43 xuống khoảng 33 FPS.
- `Esc`: tạm dừng / tiếp tục
- `R`: chơi lại (Đấu Đội: về màn hình chính)
