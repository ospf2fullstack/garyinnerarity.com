import os
import csv

directory = '../'

csv_file = 'repo.csv'

def list_directory_structure(dir_path):
    for root, dirs, files in os.walk(dir_path):
        # Skip .git directories and its contents
        if '.git' in dirs:
            dirs.remove('.git')
        for dir_name in dirs:
            yield "", os.path.join(root, dir_name).replace(dir_path, '').replace(os.sep, '/')
        for file_name in files:
            yield "", os.path.join(root, file_name).replace(dir_path, '').replace(os.sep, '/')

with open(csv_file, 'w', newline='') as file:
    writer = csv.writer(file)
    writer.writerow(['size', 'path'])  # Header
    for size, item in list_directory_structure(directory):
        writer.writerow([size, item])

print(f'Directory structure written to {csv_file}')
