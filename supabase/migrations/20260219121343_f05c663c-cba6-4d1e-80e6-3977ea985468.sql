
-- Step 1: Add unique constraint on (name, province_id) to prevent duplicates
ALTER TABLE public.municipalities ADD CONSTRAINT municipalities_name_province_unique UNIQUE (name, province_id);

-- Step 2: Clean up existing Limpopo entries
-- Delete duplicate BELABELA (keep BELA-BELA)
DELETE FROM public.municipalities WHERE id = '1ac5b269-7b3c-42ac-8b4e-48cff9929cf3';

-- Rename malformed entries to canonical names
UPDATE public.municipalities SET name = 'Bela-Bela' WHERE id = '850222dc-0de7-40c4-81ef-4cf0de100735';
UPDATE public.municipalities SET name = 'Blouberg' WHERE id = 'b9cd643e-09d3-43f9-810a-a4b042f8c043';
UPDATE public.municipalities SET name = 'Elias Motsoaledi' WHERE id = 'e206f830-0828-4b32-b65e-b08f474747af';
UPDATE public.municipalities SET name = 'Ephraim Mogale' WHERE id = 'c8afa7d1-b08b-4509-9b66-aaec63474d8d';
UPDATE public.municipalities SET name = 'Greater Letaba' WHERE id = 'b6cfa409-3399-4a1d-bd0b-9caaa91aaaff';
UPDATE public.municipalities SET name = 'Greater Tzaneen' WHERE id = '3f8e2914-13ef-4210-8ca5-8d40bae52ca1';
UPDATE public.municipalities SET name = 'Lephalale' WHERE id = '92199c66-4dc3-4abb-914b-80e451b73da5';
UPDATE public.municipalities SET name = 'Ba-Phalaborwa' WHERE id = '1710d2fd-096b-4417-8c80-9eb469cc5399';
UPDATE public.municipalities SET name = 'Makhado' WHERE id = '5646fa23-bec8-4645-b571-9a7572a95ae4';
UPDATE public.municipalities SET name = 'Modimolle-Mookgophong' WHERE id = 'c127e87a-cc94-45dd-877e-1547376fc5ed';
UPDATE public.municipalities SET name = 'Mogalakwena' WHERE id = '48915a40-79b7-4529-84b2-e70c19b221bd';
UPDATE public.municipalities SET name = 'Molemole' WHERE id = '60dc6622-8111-45d5-9e52-b26a8478e978';
UPDATE public.municipalities SET name = 'Musina' WHERE id = '7eaf6e67-0736-4a7a-bca5-af3d5d38a963';
UPDATE public.municipalities SET name = 'Polokwane' WHERE id = '5fa4f1fc-54fc-49da-94b7-84e07649e6e6';
UPDATE public.municipalities SET name = 'Thabazimbi' WHERE id = '2f5eca9e-486c-4def-8286-709a2bdcf5ae';

-- Step 3: Seed all South African municipalities
-- Using ON CONFLICT to skip any that already exist after cleanup

-- Eastern Cape (9249a651-41b4-4f53-bdea-4e426f60fb24)
INSERT INTO public.municipalities (name, province_id) VALUES
  ('Buffalo City', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Nelson Mandela Bay', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Amahlathi', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Blue Crane Route', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Dr Beyers Naudé', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Elundini', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Emalahleni', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Engcobo', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Enoch Mgijima', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Great Kei', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Ingquza Hill', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Intsika Yethu', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Inxuba Yethemba', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('King Sabata Dalindyebo', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Kouga', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Koukamma', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Makana', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Matatiele', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Mbhashe', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Mhlontlo', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Mnquma', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Ndlambe', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Ngqushwa', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Ntabankulu', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Nyandeni', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Port St Johns', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Raymond Mhlaba', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Sakhisizwe', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Senqu', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Sundays River Valley', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Umzimvubu', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Walter Sisulu', '9249a651-41b4-4f53-bdea-4e426f60fb24'),
  ('Winnie Madikizela-Mandela', '9249a651-41b4-4f53-bdea-4e426f60fb24')
ON CONFLICT (name, province_id) DO NOTHING;

-- Free State (0bff4a40-a6b9-41d0-a612-979b23fcd8fd)
INSERT INTO public.municipalities (name, province_id) VALUES
  ('Mangaung', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Dihlabeng', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Kopanong', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Letsemeng', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Mafube', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Masilonyana', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Matjhabeng', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Metsimaholo', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Moqhaka', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Mohokare', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Nala', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Naledi', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Ngwathe', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Nketoana', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Phumelela', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Setsoto', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Tokologo', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Tswelopele', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd'),
  ('Mantsopa', '0bff4a40-a6b9-41d0-a612-979b23fcd8fd')
ON CONFLICT (name, province_id) DO NOTHING;

-- Gauteng (1a0a7baa-25fa-448b-86d7-cccf56dc44c0)
INSERT INTO public.municipalities (name, province_id) VALUES
  ('City of Johannesburg', '1a0a7baa-25fa-448b-86d7-cccf56dc44c0'),
  ('City of Tshwane', '1a0a7baa-25fa-448b-86d7-cccf56dc44c0'),
  ('Ekurhuleni', '1a0a7baa-25fa-448b-86d7-cccf56dc44c0'),
  ('Emfuleni', '1a0a7baa-25fa-448b-86d7-cccf56dc44c0'),
  ('Lesedi', '1a0a7baa-25fa-448b-86d7-cccf56dc44c0'),
  ('Merafong City', '1a0a7baa-25fa-448b-86d7-cccf56dc44c0'),
  ('Midvaal', '1a0a7baa-25fa-448b-86d7-cccf56dc44c0'),
  ('Mogale City', '1a0a7baa-25fa-448b-86d7-cccf56dc44c0'),
  ('Rand West City', '1a0a7baa-25fa-448b-86d7-cccf56dc44c0')
ON CONFLICT (name, province_id) DO NOTHING;

-- KwaZulu-Natal (d7e06735-f42d-434a-86e1-c099796ad4f2)
INSERT INTO public.municipalities (name, province_id) VALUES
  ('eThekwini', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('AbaQulusi', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Alfred Duma', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Big Five Hlabisa', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('City of uMhlathuze', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Dannhauser', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Dr Nkosazana Dlamini-Zuma', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('eDumbe', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Emadlangeni', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Endumeni', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Greater Kokstad', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Impendle', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Inkosi Langalibalele', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Jozini', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('KwaDukuza', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Maphumulo', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Mkhambathini', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Mpofana', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Msunduzi', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Mthonjaneni', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Mtubatuba', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Ndwedwe', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Newcastle', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Nkandla', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Nongoma', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Nqutu', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Okhahlamba', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Ray Nkonyeni', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Richmond', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Ubuhlebezwe', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Ulundi', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Umfolozi', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('uMhlabuyalingana', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('uMlalazi', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('uMngeni', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('uMshwathi', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('Umvoti', 'd7e06735-f42d-434a-86e1-c099796ad4f2'),
  ('uPhongolo', 'd7e06735-f42d-434a-86e1-c099796ad4f2')
ON CONFLICT (name, province_id) DO NOTHING;

-- Limpopo (5dcd4935-a83b-42bd-801a-2b283b8fef49) - missing ones after cleanup
INSERT INTO public.municipalities (name, province_id) VALUES
  ('Collins Chabane', '5dcd4935-a83b-42bd-801a-2b283b8fef49'),
  ('Fetakgomo Tubatse', '5dcd4935-a83b-42bd-801a-2b283b8fef49'),
  ('Greater Giyani', '5dcd4935-a83b-42bd-801a-2b283b8fef49'),
  ('Lepelle-Nkumpi', '5dcd4935-a83b-42bd-801a-2b283b8fef49'),
  ('Makhuduthamaga', '5dcd4935-a83b-42bd-801a-2b283b8fef49'),
  ('Maruleng', '5dcd4935-a83b-42bd-801a-2b283b8fef49'),
  ('Thulamela', '5dcd4935-a83b-42bd-801a-2b283b8fef49')
ON CONFLICT (name, province_id) DO NOTHING;

-- Mpumalanga (a0c1c359-1be5-4093-a14a-7503dce384c5)
INSERT INTO public.municipalities (name, province_id) VALUES
  ('Bushbuckridge', 'a0c1c359-1be5-4093-a14a-7503dce384c5'),
  ('Chief Albert Luthuli', 'a0c1c359-1be5-4093-a14a-7503dce384c5'),
  ('City of Mbombela', 'a0c1c359-1be5-4093-a14a-7503dce384c5'),
  ('Dipaleseng', 'a0c1c359-1be5-4093-a14a-7503dce384c5'),
  ('Dr JS Moroka', 'a0c1c359-1be5-4093-a14a-7503dce384c5'),
  ('Dr Pixley Ka Isaka Seme', 'a0c1c359-1be5-4093-a14a-7503dce384c5'),
  ('Emakhazeni', 'a0c1c359-1be5-4093-a14a-7503dce384c5'),
  ('Emalahleni', 'a0c1c359-1be5-4093-a14a-7503dce384c5'),
  ('Govan Mbeki', 'a0c1c359-1be5-4093-a14a-7503dce384c5'),
  ('Lekwa', 'a0c1c359-1be5-4093-a14a-7503dce384c5'),
  ('Mkhondo', 'a0c1c359-1be5-4093-a14a-7503dce384c5'),
  ('Msukaligwa', 'a0c1c359-1be5-4093-a14a-7503dce384c5'),
  ('Nkomazi', 'a0c1c359-1be5-4093-a14a-7503dce384c5'),
  ('Steve Tshwete', 'a0c1c359-1be5-4093-a14a-7503dce384c5'),
  ('Thaba Chweu', 'a0c1c359-1be5-4093-a14a-7503dce384c5'),
  ('Thembisile Hani', 'a0c1c359-1be5-4093-a14a-7503dce384c5'),
  ('Victor Khanye', 'a0c1c359-1be5-4093-a14a-7503dce384c5')
ON CONFLICT (name, province_id) DO NOTHING;

-- North West (e5b5cd66-e47d-4749-90cf-fc71d8e9bb86)
INSERT INTO public.municipalities (name, province_id) VALUES
  ('City of Matlosana', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86'),
  ('Ditsobotla', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86'),
  ('Greater Taung', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86'),
  ('JB Marks', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86'),
  ('Kagisano-Molopo', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86'),
  ('Kgetlengrivier', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86'),
  ('Lekwa-Teemane', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86'),
  ('Madibeng', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86'),
  ('Mahikeng', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86'),
  ('Mamusa', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86'),
  ('Maquassi Hills', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86'),
  ('Moretele', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86'),
  ('Moses Kotane', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86'),
  ('Naledi', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86'),
  ('Ramotshere Moiloa', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86'),
  ('Ratlou', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86'),
  ('Rustenburg', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86'),
  ('Tswaing', 'e5b5cd66-e47d-4749-90cf-fc71d8e9bb86')
ON CONFLICT (name, province_id) DO NOTHING;

-- Northern Cape (029e6c81-e5c4-46c5-9524-6e296e254a46)
INSERT INTO public.municipalities (name, province_id) VALUES
  ('//Khara Hais', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('!Kheis', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Dawid Kruiper', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Dikgatlong', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Emthanjeni', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Ga-Segonyana', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Gamagara', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Hantam', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Joe Morolong', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Kai !Garib', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Kamiesberg', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Karoo Hoogland', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Kareeberg', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Kgatelopele', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Magareng', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Nama Khoi', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Phokwane', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Renosterberg', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Richtersveld', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Siyancuma', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Siyathemba', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Sol Plaatje', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Thembelihle', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Tsantsabane', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Ubuntu', '029e6c81-e5c4-46c5-9524-6e296e254a46'),
  ('Umsobomvu', '029e6c81-e5c4-46c5-9524-6e296e254a46')
ON CONFLICT (name, province_id) DO NOTHING;

-- Western Cape (8760deb7-8cfc-4797-9983-742dbd66098a)
INSERT INTO public.municipalities (name, province_id) VALUES
  ('City of Cape Town', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Beaufort West', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Bergrivier', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Bitou', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Breede Valley', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Cape Agulhas', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Cederberg', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Drakenstein', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('George', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Hessequa', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Kannaland', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Knysna', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Laingsburg', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Langeberg', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Matzikama', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Mossel Bay', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Oudtshoorn', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Overstrand', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Prince Albert', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Saldanha Bay', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Stellenbosch', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Swartland', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Swellendam', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Theewaterskloof', '8760deb7-8cfc-4797-9983-742dbd66098a'),
  ('Witzenberg', '8760deb7-8cfc-4797-9983-742dbd66098a')
ON CONFLICT (name, province_id) DO NOTHING;

-- Eskom (8b86ee7f-d5ff-4c7f-9af9-0451ab1101b4)
INSERT INTO public.municipalities (name, province_id) VALUES
  ('Eskom Direct', '8b86ee7f-d5ff-4c7f-9af9-0451ab1101b4')
ON CONFLICT (name, province_id) DO NOTHING;
