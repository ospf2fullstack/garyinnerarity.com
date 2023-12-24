import os
import csv

# Specify the directory to list
directory = '../'  # Adjust as needed

# CSV file to store the result
csv_file = 'repo.csv'

# This function lists all files and directories
def list_directory_structure(dir_path):
    for root, dirs, files in os.walk(dir_path):
        # Skip .git directories and its contents
        if '.git' in dirs:
            dirs.remove('.git')
        # Record each directory path
        for dir_name in dirs:
            yield "", os.path.join(root, dir_name).replace(dir_path, '').replace(os.sep, '/')
        # Record each file path
        for file_name in files:
            yield "", os.path.join(root, file_name).replace(dir_path, '').replace(os.sep, '/')

# Write the directory structure to a CSV file
with open(csv_file, 'w', newline='') as file:
    writer = csv.writer(file)
    writer.writerow(['size', 'path'])  # Header
    for size, item in list_directory_structure(directory):
        writer.writerow([size, item])

print(f'Directory structure written to {csv_file}')
